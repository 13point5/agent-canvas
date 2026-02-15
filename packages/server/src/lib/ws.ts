import { existsSync } from "node:fs";
import type {
  BoardEvent,
  CreateShapesRequest,
  CreateShapesResponse,
  DeleteShapesRequest,
  DeleteShapesResponse,
  GetShapesRequest,
  GetShapesResponse,
  UpdateShapesRequest,
  UpdateShapesResponse,
} from "@agent-canvas/shared";
import type { ServerWebSocket } from "bun";
import { boardEvents } from "./events";
import { resolvePendingRequest } from "./pending-requests";

type SocketData = { kind: "board" } | { kind: "terminal"; cols: number; rows: number };
type AppWebSocket = ServerWebSocket<SocketData>;
type TerminalProcess = ReturnType<typeof Bun.spawn>;

type TerminalSession = {
  process: TerminalProcess;
};

const clients = new Set<AppWebSocket>();
const terminalSessions = new Map<AppWebSocket, TerminalSession>();

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const MIN_COLS = 20;
const MAX_COLS = 320;
const MIN_ROWS = 8;
const MAX_ROWS = 120;
const WEBSOCKET_OPEN = 1;

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
  if (shellName === "bash" || shellName === "zsh" || shellName === "sh" || shellName === "fish") {
    return ["-i"];
  }
  return [];
}

function createTerminal(ws: AppWebSocket, cols: number, rows: number): TerminalProcess {
  const shell = getDefaultShell();
  const shellArgs = getShellArgs(shell);
  const decoder = new TextDecoder();

  return Bun.spawn([shell, ...shellArgs], {
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
        if (ws.readyState !== WEBSOCKET_OPEN) {
          return;
        }

        if (typeof data === "string") {
          ws.send(data);
          return;
        }

        const decoded = decoder.decode(data, { stream: true });
        if (decoded.length > 0) {
          ws.send(decoded);
        }
      },
    },
  });
}

function getTerminalSession(ws: AppWebSocket): TerminalSession | undefined {
  return terminalSessions.get(ws);
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
  message: GetShapesRequest | CreateShapesRequest | UpdateShapesRequest | DeleteShapesRequest,
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
        const terminalProcess = createTerminal(ws, ws.data.cols, ws.data.rows);

        void terminalProcess.exited.then((exitCode) => {
          if (ws.readyState === WEBSOCKET_OPEN) {
            ws.send(`\r\n\x1b[33mShell exited (code: ${exitCode})\x1b[0m\r\n`);
            ws.close();
          }
        });

        terminalSessions.set(ws, {
          process: terminalProcess,
        });

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
    const terminalSession = getTerminalSession(ws);
    if (terminalSession) {
      terminalSessions.delete(ws);
      try {
        terminalSession.process.kill();
      } catch {
        // Process may already be closed.
      }
      return;
    }

    removeClient(ws);
  },
  message(ws: AppWebSocket, message: string | Buffer) {
    const terminalSession = getTerminalSession(ws);
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
        | DeleteShapesResponse;

      if (data.type === "get-shapes:response") {
        resolvePendingRequest(data.requestId, data.shapes, data.error);
      } else if (data.type === "create-shapes:response") {
        resolvePendingRequest(data.requestId, { createdIds: data.createdIds, idMap: data.idMap }, data.error);
      } else if (data.type === "update-shapes:response") {
        resolvePendingRequest(data.requestId, { updatedIds: data.updatedIds }, data.error);
      } else if (data.type === "delete-shapes:response") {
        resolvePendingRequest(data.requestId, { deletedIds: data.deletedIds }, data.error);
      }
    } catch {
      // Ignore malformed messages
    }
  },
};
