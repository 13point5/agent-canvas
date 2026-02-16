#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_INSTANCE_ID, getInstanceId, readLockfile, removeLockfile } from "@agent-canvas/server";
import { Command } from "commander";
import open from "open";
import {
  ApiError,
  checkHealth,
  createBoard,
  createBoardShapes,
  deleteBoardShapes,
  getBoardShapes,
  listBoards,
  ServerNotRunningError,
  screenshotBoardShapes,
  updateBoard,
  updateBoardShapes,
} from "./api-client";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Detect if running from built CLI (dist/) or dev mode (src/)
// Built CLI should use global instance, dev mode should use git-based isolation
const isBuiltCLI = __dirname.includes("/dist");
const cliInstanceId = isBuiltCLI ? DEFAULT_INSTANCE_ID : getInstanceId();

// Load package.json for version
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const program = new Command();

program.name("agent-canvas").description("A canvas for your coding agents").version(pkg.version);

const DEFAULT_MAX_SHAPE_CONTENT_CHARS = 100;
const YAML_PLAIN_STRING_PATTERN = /^[A-Za-z0-9_./:-]+$/;

const LONG_SHAPE_PROP_KEYS = new Set([
  "text",
  "content",
  "richText",
  "contents",
  "code",
  "trace",
  "output",
  "description",
  "requestBodyExample",
  "responseBodyExample",
  "tests",
  "logs",
  "entries",
  "parameters",
  "requestFields",
  "responseFields",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncateText(value: string, maxChars: number): { value: string; omittedChars: number } {
  const omittedChars = value.length - maxChars;
  if (omittedChars <= 0) {
    return { value, omittedChars: 0 };
  }

  return {
    value: `${value.slice(0, maxChars)}... (+${omittedChars} chars)`,
    omittedChars,
  };
}

function toSummaryString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function summarizeLongValue(value: unknown, maxChars: number): { value: string; omittedChars: number } {
  return truncateText(toSummaryString(value), maxChars);
}

function summarizeCodeDiffFile(file: unknown): Record<string, unknown> | undefined {
  if (!isRecord(file)) {
    return undefined;
  }

  const summary: Record<string, unknown> = {};

  if (typeof file.name === "string") {
    summary.name = file.name;
  }

  return Object.keys(summary).length > 0 ? summary : undefined;
}

function summarizeShapeProps(props: unknown, maxChars: number): Record<string, unknown> | undefined {
  if (!isRecord(props)) {
    return undefined;
  }

  const summary: Record<string, unknown> = {};
  const passthroughKeys = [
    "name",
    "w",
    "h",
    "geo",
    "filePath",
    "url",
    "assetId",
    "method",
    "path",
    "language",
    "prefix",
    "selectedPath",
    "isStreaming",
    "autoScroll",
    "showInternalFrames",
    "summary",
  ];

  for (const key of passthroughKeys) {
    if (key in props && props[key] !== undefined) {
      summary[key] = props[key];
    }
  }

  for (const key of LONG_SHAPE_PROP_KEYS) {
    if (key in props && props[key] !== undefined) {
      const valueSummary = summarizeLongValue(props[key], maxChars);
      summary[key] = valueSummary.value;
    }
  }

  if ("oldFile" in props && props.oldFile !== undefined) {
    const oldFile = summarizeCodeDiffFile(props.oldFile);
    if (oldFile) {
      summary.oldFile = oldFile;
    }
  }

  if ("newFile" in props && props.newFile !== undefined) {
    const newFile = summarizeCodeDiffFile(props.newFile);
    if (newFile) {
      summary.newFile = newFile;
    }
  }

  summary._partial = true;

  return Object.keys(summary).length > 0 ? summary : undefined;
}

function summarizeShape(shape: unknown, maxChars: number): Record<string, unknown> {
  if (!isRecord(shape)) {
    return { shape: summarizeLongValue(shape, maxChars).value };
  }

  const summary: Record<string, unknown> = {};

  if (typeof shape.id === "string") {
    summary.id = shape.id;
  }

  if (typeof shape.type === "string") {
    summary.type = shape.type;
  }

  if (typeof shape.parentId === "string") {
    summary.parentId = shape.parentId;
  }

  if (typeof shape.x === "number") {
    summary.x = shape.x;
  }

  if (typeof shape.y === "number") {
    summary.y = shape.y;
  }

  const props = summarizeShapeProps(shape.props, maxChars);
  if (props) {
    summary.props = props;
  }

  if (Object.keys(summary).length > 0) {
    return summary;
  }

  return { shape: summarizeLongValue(shape, maxChars).value };
}

function parseShapeIdsJson(ids: string): string[] {
  let idsArray: unknown;

  try {
    idsArray = JSON.parse(ids);
  } catch {
    console.error("--ids must be valid JSON");
    process.exit(1);
  }

  if (!Array.isArray(idsArray) || idsArray.some((id) => typeof id !== "string")) {
    console.error("--ids must be a JSON array of strings");
    process.exit(1);
  }

  return idsArray;
}

function filterShapesByIds(shapes: unknown[], ids: string[]): unknown[] {
  const shapesById = new Map<string, unknown>();

  for (const shape of shapes) {
    if (isRecord(shape) && typeof shape.id === "string" && !shapesById.has(shape.id)) {
      shapesById.set(shape.id, shape);
    }
  }

  return ids.flatMap((id) => (shapesById.has(id) ? [shapesById.get(id)] : []));
}

function formatYamlScalar(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "string") {
    if (value.length === 0) {
      return '""';
    }

    const lowerValue = value.toLowerCase();
    const looksLikeReservedKeyword = lowerValue === "null" || lowerValue === "true" || lowerValue === "false";
    const looksLikeNumber = /^-?\d+(\.\d+)?$/.test(value);

    if (!looksLikeReservedKeyword && !looksLikeNumber && YAML_PLAIN_STRING_PATTERN.test(value)) {
      return value;
    }

    return JSON.stringify(value);
  }

  return JSON.stringify(value);
}

function toYamlLikeLines(value: unknown, indent = 0): string[] {
  const padding = " ".repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${padding}[]`];
    }

    const lines: string[] = [];

    for (const item of value) {
      if (Array.isArray(item) || isRecord(item)) {
        lines.push(`${padding}-`);
        lines.push(...toYamlLikeLines(item, indent + 2));
      } else {
        lines.push(`${padding}- ${formatYamlScalar(item)}`);
      }
    }

    return lines;
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([, itemValue]) => itemValue !== undefined);
    if (entries.length === 0) {
      return [`${padding}{}`];
    }

    const lines: string[] = [];
    for (const [key, itemValue] of entries) {
      if (Array.isArray(itemValue) || isRecord(itemValue)) {
        if (Array.isArray(itemValue) && itemValue.length === 0) {
          lines.push(`${padding}${key}: []`);
          continue;
        }

        if (isRecord(itemValue) && Object.keys(itemValue).length === 0) {
          lines.push(`${padding}${key}: {}`);
          continue;
        }

        lines.push(`${padding}${key}:`);
        lines.push(...toYamlLikeLines(itemValue, indent + 2));
      } else {
        lines.push(`${padding}${key}: ${formatYamlScalar(itemValue)}`);
      }
    }

    return lines;
  }

  return [`${padding}${formatYamlScalar(value)}`];
}

function toYamlLikeString(value: unknown): string {
  return toYamlLikeLines(value).join("\n");
}

type MarkdownCommentAuthor = { type: "user" } | { type: "agent"; name: string };

type MarkdownCommentTarget =
  | { type: "shape" }
  | {
      type: "text";
      start: number;
      end: number;
      quote: string;
      prefix?: string;
      suffix?: string;
    }
  | {
      type: "line";
      line: number;
      lineText?: string;
      previousLineText?: string | null;
      nextLineText?: string | null;
    }
  | { type: "diagram"; diagramId: string };

type MarkdownCommentMessage = {
  id: string;
  body: string;
  author: MarkdownCommentAuthor;
  createdAt: string;
  editedAt?: string | null;
};

type MarkdownCommentThread = {
  id: string;
  target: MarkdownCommentTarget;
  messages: MarkdownCommentMessage[];
  resolvedAt: string | null;
};

type CommentAddOptions = {
  board: string;
  shape: string;
  body: string;
  comment?: string;
  target?: string;
  author: string;
  agent?: string;
  json?: boolean;
};

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asOptionalNullableString(value: unknown): string | null | undefined {
  if (typeof value === "string" || value === null) return value;
  return undefined;
}

function asNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value;
}

function asInteger(value: unknown, fieldName: string, minimum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw new Error(`${fieldName} must be an integer >= ${minimum}`);
  }
  return value;
}

function parseCommentAuthor(rawAuthor: unknown): MarkdownCommentAuthor {
  if (!isRecord(rawAuthor)) {
    return { type: "user" };
  }

  if (rawAuthor.type === "agent") {
    if (typeof rawAuthor.name !== "string" || rawAuthor.name.trim().length === 0) {
      return { type: "user" };
    }
    return {
      type: "agent",
      name: rawAuthor.name,
    };
  }

  return { type: "user" };
}

function parseCommentTarget(rawTarget: unknown): MarkdownCommentTarget {
  if (!isRecord(rawTarget) || typeof rawTarget.type !== "string") {
    throw new Error("target must be an object with a string type field");
  }

  switch (rawTarget.type) {
    case "shape":
      return { type: "shape" };
    case "text": {
      const prefix = asOptionalString(rawTarget.prefix);
      const suffix = asOptionalString(rawTarget.suffix);

      return {
        type: "text",
        start: asInteger(rawTarget.start, "target.start", 0),
        end: asInteger(rawTarget.end, "target.end", 0),
        quote: asNonEmptyString(rawTarget.quote, "target.quote"),
        ...(prefix !== undefined ? { prefix } : {}),
        ...(suffix !== undefined ? { suffix } : {}),
      };
    }
    case "line": {
      const lineText = asOptionalString(rawTarget.lineText);
      const previousLineText = asOptionalNullableString(rawTarget.previousLineText);
      const nextLineText = asOptionalNullableString(rawTarget.nextLineText);

      return {
        type: "line",
        line: asInteger(rawTarget.line, "target.line", 1),
        ...(lineText !== undefined ? { lineText } : {}),
        ...(previousLineText !== undefined ? { previousLineText } : {}),
        ...(nextLineText !== undefined ? { nextLineText } : {}),
      };
    }
    case "diagram":
      return {
        type: "diagram",
        diagramId: asNonEmptyString(rawTarget.diagramId, "target.diagramId"),
      };
    default:
      throw new Error("target.type must be one of: shape, text, line, diagram");
  }
}

function parseCommentTargetJson(targetJson: string): MarkdownCommentTarget {
  let parsed: unknown;
  try {
    parsed = JSON.parse(targetJson);
  } catch {
    throw new Error("--target must be valid JSON");
  }

  return parseCommentTarget(parsed);
}

function parseCommentThread(rawComment: unknown, index: number): MarkdownCommentThread {
  if (!isRecord(rawComment)) {
    throw new Error(`Existing comment at index ${index} is not an object`);
  }

  const commentId = asNonEmptyString(rawComment.id, `comments[${index}].id`);
  const target = parseCommentTarget(rawComment.target);

  if (Array.isArray(rawComment.messages)) {
    const messages: MarkdownCommentMessage[] = rawComment.messages.map((rawMessage, messageIndex) => {
      if (!isRecord(rawMessage)) {
        throw new Error(`comments[${index}].messages[${messageIndex}] is not an object`);
      }

      const messageId = asNonEmptyString(rawMessage.id, `comments[${index}].messages[${messageIndex}].id`);
      const body = typeof rawMessage.body === "string" ? rawMessage.body : "";
      const createdAt =
        typeof rawMessage.createdAt === "string" && rawMessage.createdAt.length > 0
          ? rawMessage.createdAt
          : new Date().toISOString();
      const editedAt = asOptionalNullableString(rawMessage.editedAt);

      return {
        id: messageId,
        body,
        author: parseCommentAuthor(rawMessage.author),
        createdAt,
        ...(editedAt !== undefined ? { editedAt } : {}),
      };
    });

    return {
      id: commentId,
      target,
      messages,
      resolvedAt: typeof rawComment.resolvedAt === "string" ? rawComment.resolvedAt : null,
    };
  }

  // Backward compatibility: single-message comments from older boards.
  const fallbackCreatedAt =
    typeof rawComment.createdAt === "string" && rawComment.createdAt.length > 0
      ? rawComment.createdAt
      : new Date().toISOString();

  return {
    id: commentId,
    target,
    messages: [
      {
        id: `${commentId}-message-0`,
        body: typeof rawComment.body === "string" ? rawComment.body : "",
        author: parseCommentAuthor(rawComment.author),
        createdAt: fallbackCreatedAt,
        editedAt: null,
      },
    ],
    resolvedAt: typeof rawComment.resolvedAt === "string" ? rawComment.resolvedAt : null,
  };
}

function parseCommentThreads(rawComments: unknown): MarkdownCommentThread[] {
  if (!Array.isArray(rawComments)) {
    return [];
  }

  return rawComments.map((rawComment, index) => parseCommentThread(rawComment, index));
}

function resolveMessageAuthor(authorType: string, agentName: string | undefined): MarkdownCommentAuthor {
  const normalizedType = authorType.trim().toLowerCase();
  if (normalizedType === "user") {
    return { type: "user" };
  }

  if (normalizedType === "agent") {
    const resolvedName = (agentName ?? process.env.AGENT_CANVAS_AGENT_NAME ?? "Codex").trim();
    if (!resolvedName) {
      throw new Error("Agent author requires a non-empty name (--agent <name> or AGENT_CANVAS_AGENT_NAME)");
    }
    return {
      type: "agent",
      name: resolvedName,
    };
  }

  throw new Error("--author must be either 'user' or 'agent'");
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildCommentMessage(body: string, author: MarkdownCommentAuthor): MarkdownCommentMessage {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("--body must contain non-whitespace text");
  }

  return {
    id: makeId("message"),
    body: trimmed,
    author,
    createdAt: new Date().toISOString(),
    editedAt: null,
  };
}

function getMarkdownShapeFromShapes(
  shapes: unknown[],
  shapeId: string,
): {
  id: string;
  comments: MarkdownCommentThread[];
} {
  const found = shapes.find((shape) => isRecord(shape) && shape.id === shapeId);
  if (!found) {
    throw new Error(`Shape not found: ${shapeId}`);
  }

  if (!isRecord(found)) {
    throw new Error(`Shape ${shapeId} is malformed`);
  }

  if (found.type !== "markdown") {
    throw new Error(`Shape ${shapeId} is not a markdown shape`);
  }

  const props = isRecord(found.props) ? found.props : {};
  const comments = parseCommentThreads(props.comments);

  return {
    id: shapeId,
    comments,
  };
}

// ─── open ───────────────────────────────────────────

program
  .command("open")
  .description("Launch the Agent Canvas web interface")
  .option("-p, --port <number>", "Port to run the server on (default: 3456, use 0 to auto-select)", "3456")
  .option("--headless", "Start server without opening browser (for agents)")
  .action(async (options: { port: string; headless?: boolean }) => {
    // Check if already running
    const existing = readLockfile(cliInstanceId);
    if (existing) {
      console.log(`Agent Canvas is already running at ${existing.url}`);
      if (!options.headless) {
        await open(existing.url);
      }
      return;
    }

    // Find web directory (bundled with CLI)
    const webDir = join(__dirname, "..", "web");
    if (!existsSync(webDir)) {
      console.error(
        "Web assets not found. This might be a development build issue.\n" +
          "Run `bun run build` from the monorepo root to bundle the web app.",
      );
      process.exit(1);
    }

    // Get port
    const requestedPort = Number.parseInt(options.port, 10);
    const port = Number.isNaN(requestedPort) ? 3456 : Math.max(0, requestedPort);

    // In built version, __dirname points to dist/ and we have server.js
    // In dev, we're in src/ and we have server.ts
    const serverScript = existsSync(join(__dirname, "server.js"))
      ? join(__dirname, "server.js")
      : join(__dirname, "server.ts");
    const startServer = async (targetPort: number) => {
      const child = spawn("bun", [serverScript, String(targetPort), webDir], {
        detached: true,
        stdio: "ignore",
        env: {
          ...process.env,
          AGENT_CANVAS_CLI_INSTANCE: cliInstanceId,
        },
      });

      child.unref();

      // Poll for lockfile (up to 2s)
      let lockfile = null;
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 100));
        lockfile = readLockfile();
        if (lockfile) break;
      }

      return lockfile;
    };

    let lockfile = await startServer(port);

    // Keep default behavior centered on 3456, but avoid hard failure if it's occupied.
    if (!lockfile && port === 3456) {
      lockfile = await startServer(0);
      if (lockfile) {
        console.log("Port 3456 is in use. Started on an available port instead.");
      }
    }

    if (!lockfile) {
      console.error("Failed to start server.");
      process.exit(1);
    }

    console.log(`Agent Canvas is running at ${lockfile.url}`);

    if (!options.headless) {
      open(lockfile.url);
    }

    console.log("Run 'agent-canvas close' to stop the server.");
  });

// ─── status ─────────────────────────────────────────

program
  .command("status")
  .description("Check if the Agent Canvas server is running")
  .option("--json", "Output machine-readable JSON")
  .action(async (options: { json?: boolean }) => {
    const lockfile = readLockfile(cliInstanceId);

    if (!lockfile) {
      if (options.json) {
        console.log(JSON.stringify({ server: { running: false }, clients: 0 }));
      } else {
        console.log("Server: not running");
      }
      return;
    }

    // Server lockfile exists and process is alive — check health endpoint
    let clients = 0;
    try {
      const health = await checkHealth();
      clients = health.clients;
    } catch (error) {
      if (error instanceof ServerNotRunningError) {
        if (options.json) {
          console.log(JSON.stringify({ server: { running: false }, clients: 0 }));
        } else {
          console.log("Server: not running");
        }
        return;
      }
      // Health check failed but process is running — report 0 clients
    }

    if (options.json) {
      console.log(
        JSON.stringify({
          server: {
            running: true,
            url: lockfile.url,
            pid: lockfile.pid,
            port: lockfile.port,
          },
          clients,
        }),
      );
    } else {
      console.log(`Server: running at ${lockfile.url} (PID ${lockfile.pid})`);
      console.log(`Web clients: ${clients} connected`);
    }
  });

// ─── close ──────────────────────────────────────────

program
  .command("close")
  .description("Stop the Agent Canvas server")
  .option("-f, --force", "Force kill if graceful shutdown fails")
  .action(async (options: { force?: boolean }) => {
    const lockfile = readLockfile(cliInstanceId);

    if (!lockfile) {
      console.log("Agent Canvas server is not running.");
      return;
    }

    const { pid } = lockfile;

    // Check if process is actually running
    const isRunning = () => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };

    if (!isRunning()) {
      removeLockfile(cliInstanceId);
      console.log("Agent Canvas server was not running (stale lockfile cleaned up).");
      return;
    }

    // Try graceful shutdown first
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      removeLockfile(cliInstanceId);
      console.log("Agent Canvas server stopped.");
      return;
    }

    // Wait for process to exit (up to 3 seconds)
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (!isRunning()) {
        removeLockfile(cliInstanceId);
        console.log("Agent Canvas server stopped.");
        return;
      }
    }

    // If still running and force flag, use SIGKILL
    if (options.force) {
      try {
        process.kill(pid, "SIGKILL");
        removeLockfile(cliInstanceId);
        console.log("Agent Canvas server force killed.");
        return;
      } catch {
        // Ignore
      }
    }

    // Still running
    if (isRunning()) {
      console.log(`Server (PID ${pid}) did not stop. Try: agent-canvas close --force`);
    } else {
      removeLockfile(cliInstanceId);
      console.log("Agent Canvas server stopped.");
    }
  });

// ─── boards ────────────────────────────────────────

const boards = program.command("boards").description("Manage boards");

boards
  .command("list")
  .description("List all boards")
  .option("--json", "Output machine-readable JSON")
  .action(async (options: { json?: boolean }) => {
    try {
      const result = await listBoards();

      if (options.json) {
        console.log(JSON.stringify(result));
      } else if (result.length === 0) {
        console.log("No boards found.");
      } else {
        for (const board of result) {
          console.log(`${board.name}`);
          console.log(`  ID:         ${board.id}`);
          console.log(`  Created at: ${board.createdAt}`);
          console.log(`  Updated at: ${board.updatedAt}`);
          console.log();
        }
      }
    } catch (error) {
      if (error instanceof ServerNotRunningError) {
        console.error(error.message);
        process.exit(1);
      }
      throw error;
    }
  });

boards
  .command("create")
  .description("Create a new board")
  .argument("<name>", "Name for the new board")
  .option("--json", "Output machine-readable JSON")
  .action(async (name: string, options: { json?: boolean }) => {
    try {
      const board = await createBoard(name);

      if (options.json) {
        console.log(JSON.stringify(board));
      } else {
        console.log(`Created board: ${board.name} (${board.id})`);
      }
    } catch (error) {
      if (error instanceof ServerNotRunningError) {
        console.error(error.message);
        process.exit(1);
      }
      throw error;
    }
  });

boards
  .command("rename")
  .description("Rename an existing board")
  .argument("<name>", "New name for the board")
  .requiredOption("--id <id>", "Board ID to rename")
  .option("--json", "Output machine-readable JSON")
  .action(async (name: string, options: { id: string; json?: boolean }) => {
    try {
      const board = await updateBoard(options.id, name);

      if (options.json) {
        console.log(JSON.stringify(board));
      } else {
        console.log(`Renamed board ${options.id} to: ${board.name}`);
      }
    } catch (error) {
      if (error instanceof ServerNotRunningError) {
        console.error(error.message);
        process.exit(1);
      }
      throw error;
    }
  });

// ─── shapes ───────────────────────────────────────

const shapes = program.command("shapes").description("Read and write shapes on a board");

shapes
  .command("get")
  .description("Get shapes from a board (compact YAML-like output by default)")
  .requiredOption("--board <id>", "Board ID")
  .option("--ids <json>", "JSON array of shape IDs to return")
  .option("--full", "Return full shape payloads")
  .option("--json", "Return JSON output instead of compact YAML-like text")
  .option(
    "--max-chars <number>",
    "Max characters for long fields when not using --full",
    String(DEFAULT_MAX_SHAPE_CONTENT_CHARS),
  )
  .action(async (options: { board: string; ids?: string; full?: boolean; json?: boolean; maxChars: string }) => {
    const maxChars = Number.parseInt(options.maxChars, 10);
    if (!Number.isFinite(maxChars) || maxChars < 1) {
      console.error("--max-chars must be a positive integer");
      process.exit(1);
    }

    const ids = options.ids ? parseShapeIdsJson(options.ids) : undefined;

    try {
      const result = await getBoardShapes(options.board);
      const filteredShapes = ids ? filterShapesByIds(result.shapes, ids) : result.shapes;
      const shapesToOutput = options.full
        ? filteredShapes
        : filteredShapes.map((shape) => summarizeShape(shape, maxChars));
      const payload = {
        ...result,
        shapes: shapesToOutput,
      };

      if (options.json) {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        console.log(toYamlLikeString(payload));
      }
    } catch (error) {
      if (error instanceof ServerNotRunningError || error instanceof ApiError) {
        console.error(error.message);
        process.exit(1);
      }
      throw error;
    }
  });

shapes
  .command("create")
  .description("Create shapes on a board")
  .requiredOption("--board <id>", "Board ID")
  .requiredOption("--shapes <json>", "JSON array of shape objects")
  .action(async (options: { board: string; shapes: string }) => {
    try {
      let shapesArray: unknown[];
      try {
        shapesArray = JSON.parse(options.shapes);
        if (!Array.isArray(shapesArray)) {
          console.error("--shapes must be a JSON array");
          process.exit(1);
        }
      } catch {
        console.error("--shapes must be valid JSON");
        process.exit(1);
      }

      const result = await createBoardShapes(options.board, shapesArray);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      if (error instanceof ServerNotRunningError || error instanceof ApiError) {
        console.error(error.message);
        process.exit(1);
      }
      throw error;
    }
  });

shapes
  .command("update")
  .description("Update shapes on a board")
  .requiredOption("--board <id>", "Board ID")
  .requiredOption("--shapes <json>", "JSON array of shape update objects (each needs id and type)")
  .action(async (options: { board: string; shapes: string }) => {
    try {
      let shapesArray: unknown[];
      try {
        shapesArray = JSON.parse(options.shapes);
        if (!Array.isArray(shapesArray)) {
          console.error("--shapes must be a JSON array");
          process.exit(1);
        }
      } catch {
        console.error("--shapes must be valid JSON");
        process.exit(1);
      }

      const result = await updateBoardShapes(options.board, shapesArray);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      if (error instanceof ServerNotRunningError || error instanceof ApiError) {
        console.error(error.message);
        process.exit(1);
      }
      throw error;
    }
  });

shapes
  .command("delete")
  .description("Delete shapes from a board")
  .requiredOption("--board <id>", "Board ID")
  .requiredOption("--ids <json>", "JSON array of shape IDs to delete")
  .action(async (options: { board: string; ids: string }) => {
    try {
      const idsArray = parseShapeIdsJson(options.ids);

      const result = await deleteBoardShapes(options.board, idsArray);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      if (error instanceof ServerNotRunningError || error instanceof ApiError) {
        console.error(error.message);
        process.exit(1);
      }
      throw error;
    }
  });

// ─── screenshot ───────────────────────────────────────

program
  .command("screenshot")
  .description("Capture a screenshot of selected shapes on a board")
  .requiredOption("--board <id>", "Board ID")
  .requiredOption("--ids <json>", "JSON array of shape IDs to capture")
  .action(async (options: { board: string; ids: string }) => {
    try {
      let idsArray: string[];
      try {
        const parsed = JSON.parse(options.ids);
        if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== "string")) {
          console.error("--ids must be a JSON array of shape ID strings");
          process.exit(1);
        }
        idsArray = parsed;
      } catch {
        console.error("--ids must be valid JSON");
        process.exit(1);
      }

      if (idsArray.length === 0) {
        console.error("--ids must include at least one shape ID");
        process.exit(1);
      }

      const result = await screenshotBoardShapes(options.board, idsArray);
      console.log(result.filePath);
    } catch (error) {
      if (error instanceof ServerNotRunningError || error instanceof ApiError) {
        console.error(error.message);
        process.exit(1);
      }
      throw error;
    }
  });

// ─── comments ─────────────────────────────────────

const comments = program.command("comments").description("Manage markdown comments");

comments
  .command("add")
  .description(
    "Add a comment message to a markdown shape. Creates a new thread with --target, or appends to an existing thread with --comment.",
  )
  .requiredOption("--board <id>", "Board ID")
  .requiredOption("--shape <id>", "Markdown shape ID")
  .requiredOption("--body <text>", "Comment message body")
  .option("--comment <id>", "Existing comment thread ID (append a message)")
  .option("--target <json>", 'JSON target for a new thread, e.g. \'{"type":"text","start":10,"end":30,"quote":"abc"}\'')
  .option("--author <type>", "Message author type: user or agent", "agent")
  .option("--agent <name>", "Agent name for --author agent (defaults to AGENT_CANVAS_AGENT_NAME or Codex)")
  .option("--json", "Output machine-readable JSON")
  .action(async (options: CommentAddOptions) => {
    try {
      if (options.comment && options.target) {
        console.error("--comment and --target are mutually exclusive");
        process.exit(1);
      }

      if (!options.comment && !options.target) {
        console.error("--target is required when creating a new thread");
        process.exit(1);
      }

      const author = resolveMessageAuthor(options.author, options.agent);
      const newMessage = buildCommentMessage(options.body, author);

      const { shapes: shapeSnapshots } = await getBoardShapes(options.board);
      const markdownShape = getMarkdownShapeFromShapes(shapeSnapshots, options.shape);

      let action: "thread_created" | "message_added";
      let nextComments: MarkdownCommentThread[];
      let threadId: string;

      if (options.comment) {
        const existingThreadIndex = markdownShape.comments.findIndex((comment) => comment.id === options.comment);
        if (existingThreadIndex < 0) {
          console.error(`Comment thread not found on shape ${options.shape}: ${options.comment}`);
          process.exit(1);
        }

        threadId = options.comment;
        nextComments = markdownShape.comments.map((comment, index) => {
          if (index !== existingThreadIndex) return comment;
          return {
            ...comment,
            messages: [...comment.messages, newMessage],
          };
        });
        action = "message_added";
      } else {
        const target = parseCommentTargetJson(options.target ?? "");
        threadId = makeId("comment");

        nextComments = [
          ...markdownShape.comments,
          {
            id: threadId,
            target,
            messages: [newMessage],
            resolvedAt: null,
          },
        ];
        action = "thread_created";
      }

      const updateResult = await updateBoardShapes(options.board, [
        {
          id: markdownShape.id,
          type: "markdown",
          props: {
            comments: nextComments,
          },
        },
      ]);

      const result = {
        boardId: options.board,
        shapeId: markdownShape.id,
        threadId,
        messageId: newMessage.id,
        action,
        updatedIds: updateResult.updatedIds,
      };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(
          `${action === "thread_created" ? "Created comment thread" : "Added message"} ${threadId} on markdown shape ${markdownShape.id}`,
        );
        if (author.type === "agent") {
          console.log(`Author: agent (${author.name})`);
        } else {
          console.log("Author: user");
        }
      }
    } catch (error) {
      if (error instanceof ServerNotRunningError || error instanceof ApiError) {
        console.error(error.message);
        process.exit(1);
      }
      if (error instanceof Error) {
        console.error(error.message);
        process.exit(1);
      }
      throw error;
    }
  });

// Show help when no command is provided
program.action(() => {
  console.log(`
╭───────────────────────────────────────╮
│                                       │
│   agent-canvas v${pkg.version.padEnd(20)}  │
│   A canvas for your coding agents     │
│                                       │
╰───────────────────────────────────────╯
`);
  program.help();
});

program.parse();
