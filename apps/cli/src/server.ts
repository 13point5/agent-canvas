#!/usr/bin/env bun

/**
 * Background server process for agent-canvas.
 * This script is spawned by the `open` command and runs detached.
 */

import { createApp, removeLockfile, websocketHandler, writeLockfile } from "@agent-canvas/server";

const DEFAULT_PORT = 3456;
type SocketData = { kind: "board" } | { kind: "terminal"; sessionId: string; cols: number; rows: number };

// Parse arguments: port and webDir
const port = parseInt(process.argv[2], 10) || DEFAULT_PORT;
const webDir = process.argv[3];

if (!webDir) {
  console.error("Web directory not provided");
  process.exit(1);
}

// Create and start the server with WebSocket support
const app = createApp(webDir);

const server = Bun.serve<SocketData>({
  fetch(req, server) {
    // Handle WebSocket upgrade requests
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, {
        data: { kind: "board" },
      });
      if (upgraded) {
        return undefined;
      }
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    if (url.pathname === "/ws/terminal") {
      const cols = Number.parseInt(url.searchParams.get("cols") ?? "", 10);
      const rows = Number.parseInt(url.searchParams.get("rows") ?? "", 10);
      const sessionId = url.searchParams.get("session") || `terminal-${crypto.randomUUID()}`;
      const upgraded = server.upgrade(req, {
        data: {
          kind: "terminal",
          sessionId,
          cols: Number.isFinite(cols) ? cols : 80,
          rows: Number.isFinite(rows) ? rows : 24,
        },
      });
      if (upgraded) {
        return undefined;
      }
      return new Response("WebSocket upgrade failed", { status: 500 });
    }
    // Handle regular HTTP requests via Hono
    return app.fetch(req);
  },
  websocket: websocketHandler,
  port,
});

const actualPort = server.port ?? port;
const url = `http://localhost:${actualPort}`;

writeLockfile({ pid: process.pid, port: actualPort, url });

// Handle graceful shutdown
const cleanup = () => {
  removeLockfile();
  server.stop();
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("SIGHUP", cleanup);
