#!/usr/bin/env bun

/**
 * Background server process for agent-canvas.
 * This script is spawned by the `open` command and runs detached.
 */

import {
  createApp,
  removeLockfile,
  websocketHandler,
  writeLockfile,
} from "@agent-canvas/server";

const DEFAULT_PORT = 3456;

// Parse arguments: port and webDir
const port = parseInt(process.argv[2], 10) || DEFAULT_PORT;
const webDir = process.argv[3];

if (!webDir) {
  console.error("Web directory not provided");
  process.exit(1);
}

// Create and start the server with WebSocket support
const app = createApp(webDir);

const server = Bun.serve({
  fetch(req, server) {
    // Handle WebSocket upgrade requests
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
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
