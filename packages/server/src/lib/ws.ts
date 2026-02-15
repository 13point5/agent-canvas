import { existsSync } from "node:fs";
import type {
  BoardEvent,
  CreateShapesRequest,
  CreateShapesResponse,
  DeleteShapesRequest,
  DeleteShapesResponse,
  GetShapesRequest,
  GetShapesResponse,
  ScreenshotShapesRequest,
  ScreenshotShapesResponse,
  UpdateShapesRequest,
  UpdateShapesResponse,
} from "@agent-canvas/shared";
import type { ServerWebSocket } from "bun";
import { boardEvents } from "./events";
import { resolvePendingRequest } from "./pending-requests";

type SocketData = { kind: "board" } | { kind: "terminal"; sessionId: string; cols: number; rows: number };
type AppWebSocket = ServerWebSocket<SocketData>;
type TerminalProcess = ReturnType<typeof Bun.spawn>;

type TerminalSession = {
  id: string;
  process: TerminalProcess;
  clients: Set<AppWebSocket>;
  history: string;
  gcTimer: ReturnType<typeof setTimeout> | null;
};

const clients = new Set<AppWebSocket>();
const terminalSessionsById = new Map<string, TerminalSession>();
const terminalSessionBySocket = new Map<AppWebSocket, TerminalSession>();

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const MIN_COLS = 20;
const MAX_COLS = 320;
const MIN_ROWS = 8;
const MAX_ROWS = 120;
const WEBSOCKET_OPEN = 1;
const TERMINAL_HISTORY_LIMIT = 500_000;
const TERMINAL_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

function clampDimension(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.floor(value)));
}

function getDefaultShell(): string {
  if (process.platform === "win32") {
    return process.env.COMSPEC || "cmd.exe";
  }
  const envShell = process.env.SHELL;
  if (envShell && existsSync(envShell)) {
    return envShell;
  }
  if (existsSync("/bin/zsh")) {
    return "/bin/zsh";
  }
  if (existsSync("/bin/bash")) {
    return "/bin/bash";
  }
  if (existsSync("/bin/sh")) {
    return "/bin/sh";
  }
  return process.env.SHELL || "sh";
}

function getShellArgs(shellPath: string): string[] {
  if (process.platform === "win32") {
    return [];
  }

  const shellName = shellPath.split("/").pop()?.toLowerCase();
  if (shellName === "bash" || shellName === "zsh") {
    // Login + interactive better matches what users typically see in native terminals.
    return ["-il"];
  }
  if (shellName === "sh" || shellName === "fish") {
    return ["-i"];
  }
  return ["-i"];
}

function appendTerminalHistory(session: TerminalSession, chunk: string) {
  session.history += chunk;
  if (session.history.length > TERMINAL_HISTORY_LIMIT) {
    session.history = session.history.slice(-TERMINAL_HISTORY_LIMIT);
  }
}

function broadcastTerminalData(session: TerminalSession, chunk: string) {
  appendTerminalHistory(session, chunk);
  for (const ws of session.clients) {
    if (ws.readyState === WEBSOCKET_OPEN) {
      ws.send(chunk);
    }
  }
}

function clearTerminalGcTimer(session: TerminalSession) {
  if (session.gcTimer) {
    clearTimeout(session.gcTimer);
    session.gcTimer = null;
  }
}

function scheduleTerminalGc(session: TerminalSession) {
  clearTerminalGcTimer(session);
  session.gcTimer = setTimeout(() => {
    if (session.clients.size > 0) {
      return;
    }
    terminalSessionsById.delete(session.id);
    try {
      session.process.kill();
    } catch {
      // Process may already be closed.
    }
  }, TERMINAL_IDLE_TIMEOUT_MS);
}

function createTerminalSession(sessionId: string, cols: number, rows: number): TerminalSession {
  const shell = getDefaultShell();
  const shellArgs = getShellArgs(shell);
  const decoder = new TextDecoder();

  const session = {
    id: sessionId,
    process: undefined as unknown as TerminalProcess,
    clients: new Set<AppWebSocket>(),
    history: "",
    gcTimer: null,
  } satisfies TerminalSession;

  session.process = Bun.spawn([shell, ...shellArgs], {
    cwd: process.env.HOME || process.cwd(),
    env: {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      SHELL: shell,
    },
    terminal: {
      cols: clampDimension(cols, DEFAULT_COLS, MIN_COLS, MAX_COLS),
      rows: clampDimension(rows, DEFAULT_ROWS, MIN_ROWS, MAX_ROWS),
      data(_terminal, data) {
        const chunk = typeof data === "string" ? data : decoder.decode(data, { stream: true });
        if (chunk.length === 0) {
          return;
        }
        broadcastTerminalData(session, chunk);
      },
    },
  });

  void session.process.exited.then((exitCode) => {
    clearTerminalGcTimer(session);
    terminalSessionsById.delete(session.id);

    const exitMessage = `\r\n\x1b[33mShell exited (code: ${exitCode})\x1b[0m\r\n`;
    appendTerminalHistory(session, exitMessage);

    for (const ws of session.clients) {
      terminalSessionBySocket.delete(ws);
      if (ws.readyState === WEBSOCKET_OPEN) {
        ws.send(exitMessage);
        ws.close();
      }
    }
    session.clients.clear();
  });

  return session;
}

function getOrCreateTerminalSession(sessionId: string, cols: number, rows: number): TerminalSession {
  const existing = terminalSessionsById.get(sessionId);
  if (existing) {
    return existing;
  }

  const session = createTerminalSession(sessionId, cols, rows);
  terminalSessionsById.set(sessionId, session);
  return session;
}

function attachSocketToTerminalSession(ws: AppWebSocket, session: TerminalSession, cols: number, rows: number) {
  clearTerminalGcTimer(session);
  session.clients.add(ws);
  terminalSessionBySocket.set(ws, session);

  const clampedCols = clampDimension(cols, DEFAULT_COLS, MIN_COLS, MAX_COLS);
  const clampedRows = clampDimension(rows, DEFAULT_ROWS, MIN_ROWS, MAX_ROWS);
  session.process.terminal?.resize(clampedCols, clampedRows);

  if (session.history.length > 0 && ws.readyState === WEBSOCKET_OPEN) {
    ws.send(session.history);
  }
}

function detachSocketFromTerminalSession(ws: AppWebSocket): TerminalSession | undefined {
  const session = terminalSessionBySocket.get(ws);
  if (!session) {
    return undefined;
  }

  terminalSessionBySocket.delete(ws);
  session.clients.delete(ws);

  if (session.clients.size === 0) {
    scheduleTerminalGc(session);
  }

  return session;
}

export function addClient(ws: AppWebSocket) {
  clients.add(ws);
}

export function removeClient(ws: AppWebSocket) {
  clients.delete(ws);
}

export function getClientCount(): number {
  return clients.size;
}

function broadcast(event: BoardEvent) {
  const data = JSON.stringify(event);
  for (const ws of clients) {
    ws.send(data);
  }
}

export function sendToClients(
  message: GetShapesRequest | CreateShapesRequest | UpdateShapesRequest | DeleteShapesRequest | ScreenshotShapesRequest,
) {
  const data = JSON.stringify(message);
  for (const ws of clients) {
    ws.send(data);
  }
}

// Forward board events to all connected WebSocket clients
boardEvents.on("board-event", broadcast);

type TerminalResizeMessage = {
  type: "resize";
  cols: number;
  rows: number;
};

function isResizeMessage(value: unknown): value is TerminalResizeMessage {
  if (typeof value !== "object" || value === null) return false;
  const maybeMessage = value as Partial<TerminalResizeMessage>;
  return (
    maybeMessage.type === "resize" && typeof maybeMessage.cols === "number" && typeof maybeMessage.rows === "number"
  );
}

export const websocketHandler = {
  open(ws: AppWebSocket) {
    if (ws.data?.kind === "terminal") {
      try {
        const session = getOrCreateTerminalSession(ws.data.sessionId, ws.data.cols, ws.data.rows);
        attachSocketToTerminalSession(ws, session, ws.data.cols, ws.data.rows);
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to start terminal session";
        if (ws.readyState === WEBSOCKET_OPEN) {
          ws.send(`\r\n\x1b[31m${errorMessage}\x1b[0m\r\n`);
          ws.close();
        }
        return;
      }
    }

    addClient(ws);
  },
  close(ws: AppWebSocket) {
    const terminalSession = detachSocketFromTerminalSession(ws);
    if (terminalSession) {
      return;
    }

    removeClient(ws);
  },
  message(ws: AppWebSocket, message: string | Buffer) {
    const terminalSession = terminalSessionBySocket.get(ws);
    if (terminalSession) {
      const payload = typeof message === "string" ? message : message.toString();

      if (payload.trimStart().startsWith("{")) {
        try {
          const parsed = JSON.parse(payload);
          if (isResizeMessage(parsed)) {
            const cols = clampDimension(parsed.cols, DEFAULT_COLS, MIN_COLS, MAX_COLS);
            const rows = clampDimension(parsed.rows, DEFAULT_ROWS, MIN_ROWS, MAX_ROWS);
            terminalSession.process.terminal?.resize(cols, rows);
            return;
          }
        } catch {
          // Fall through and treat as terminal input.
        }
      }

      try {
        terminalSession.process.terminal?.write(payload);
      } catch {
        if (ws.readyState === WEBSOCKET_OPEN) {
          ws.close();
        }
      }
      return;
    }

    try {
      const data = JSON.parse(typeof message === "string" ? message : message.toString()) as
        | GetShapesResponse
        | CreateShapesResponse
        | UpdateShapesResponse
        | DeleteShapesResponse
        | ScreenshotShapesResponse;

      if (data.type === "get-shapes:response") {
        resolvePendingRequest(data.requestId, data.shapes, data.error);
      } else if (data.type === "create-shapes:response") {
        resolvePendingRequest(data.requestId, { createdIds: data.createdIds, idMap: data.idMap }, data.error);
      } else if (data.type === "update-shapes:response") {
        resolvePendingRequest(data.requestId, { updatedIds: data.updatedIds }, data.error);
      } else if (data.type === "delete-shapes:response") {
        resolvePendingRequest(data.requestId, { deletedIds: data.deletedIds }, data.error);
      } else if (data.type === "screenshot-shapes:response") {
        resolvePendingRequest(
          data.requestId,
          {
            imageDataUrl: data.imageDataUrl,
            width: data.width,
            height: data.height,
          },
          data.error,
        );
      }
    } catch {
      // Ignore malformed messages
    }
  },
};
