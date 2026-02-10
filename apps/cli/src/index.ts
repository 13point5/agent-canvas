#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLockfile, removeLockfile } from "@agent-canvas/server";
import { Command } from "commander";
import open from "open";
import { checkHealth, ServerNotRunningError } from "./api-client";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load package.json for version
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);

const program = new Command();

program
  .name("agent-canvas")
  .description("A canvas for your coding agents")
  .version(pkg.version);

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
          console.log(
            JSON.stringify({ server: { running: false }, clients: 0 }),
          );
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
      console.log(
        "Agent Canvas server was not running (stale lockfile cleaned up).",
      );
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
      console.log(
        `Server (PID ${pid}) did not stop. Try: agent-canvas close --force`,
      );
    } else {
      removeLockfile();
      console.log("Agent Canvas server stopped.");
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
