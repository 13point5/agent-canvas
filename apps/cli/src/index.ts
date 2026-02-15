#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLockfile, removeLockfile } from "@agent-canvas/server";
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

// Load package.json for version
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const program = new Command();

program.name("agent-canvas").description("A canvas for your coding agents").version(pkg.version);

const DEFAULT_MAX_SHAPE_CONTENT_CHARS = 100;
const YAML_PLAIN_STRING_PATTERN = /^[A-Za-z0-9_./:-]+$/;

const LONG_SHAPE_PROP_KEYS = new Set(["text", "content", "richText", "contents"]);

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
  const passthroughKeys = ["name", "w", "h", "geo", "filePath", "url", "assetId"];

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

// ─── open ───────────────────────────────────────────

program
  .command("open")
  .description("Launch the Agent Canvas web interface")
  .option("-p, --port <number>", "Port to run the server on", "0")
  .option("--headless", "Start server without opening browser (for agents)")
  .action(async (options: { port: string; headless?: boolean }) => {
    // Check if already running
    const existing = readLockfile();
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
    const requestedPort = parseInt(options.port, 10);
    const port = requestedPort || 3456;

    // Spawn the server as a detached background process
    const serverScript = join(__dirname, "server.ts");
    const child = spawn("bun", [serverScript, String(port), webDir], {
      detached: true,
      stdio: "ignore",
    });

    child.unref();

    // Poll for lockfile (up to 2s)
    let lockfile = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      lockfile = readLockfile();
      if (lockfile) break;
    }

    if (!lockfile) {
      console.error("Failed to start server. Check if the port is available.");
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
    const lockfile = readLockfile();

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
    const lockfile = readLockfile();

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
      removeLockfile();
      console.log("Agent Canvas server was not running (stale lockfile cleaned up).");
      return;
    }

    // Try graceful shutdown first
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      removeLockfile();
      console.log("Agent Canvas server stopped.");
      return;
    }

    // Wait for process to exit (up to 3 seconds)
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (!isRunning()) {
        removeLockfile();
        console.log("Agent Canvas server stopped.");
        return;
      }
    }

    // If still running and force flag, use SIGKILL
    if (options.force) {
      try {
        process.kill(pid, "SIGKILL");
        removeLockfile();
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
      removeLockfile();
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
