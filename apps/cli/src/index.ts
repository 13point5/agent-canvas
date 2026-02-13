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
  updateBoard,
  updateBoardShapes,
} from "./api-client";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load package.json for version
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const program = new Command();

program.name("agent-canvas").description("A canvas for your coding agents").version(pkg.version);

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
  .description("Get all shapes from a board")
  .requiredOption("--board <id>", "Board ID")
  .action(async (options: { board: string }) => {
    try {
      const result = await getBoardShapes(options.board);
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
      let idsArray: string[];
      try {
        idsArray = JSON.parse(options.ids);
        if (!Array.isArray(idsArray)) {
          console.error("--ids must be a JSON array");
          process.exit(1);
        }
      } catch {
        console.error("--ids must be valid JSON");
        process.exit(1);
      }

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
