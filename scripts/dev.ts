#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { getInstanceId } from "../packages/server/src/lib/lockfile";

const SERVER_BASE_PORT = 3456;
const WEB_BASE_PORT = 1305;
const PORT_SPAN = 7000;
const SEARCH_WINDOW = 1200;

function hashToInt(input: string): number {
  const hex = createHash("sha256").update(input).digest("hex").slice(0, 8);
  return Number.parseInt(hex, 16);
}

function getPreferredPort(basePort: number, seed: number): number {
  return basePort + (seed % PORT_SPAN);
}

async function isPortAvailable(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(preferredPort: number, reserved = new Set<number>()): Promise<number> {
  for (let offset = 0; offset < SEARCH_WINDOW; offset++) {
    const candidate = preferredPort + offset;
    if (candidate > 65535 || reserved.has(candidate)) {
      continue;
    }

    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to find an available port near ${preferredPort}`);
}

const instanceId = getInstanceId();
const seed = hashToInt(instanceId);

const serverPreferredPort = getPreferredPort(SERVER_BASE_PORT, seed);
const serverPort = await findAvailablePort(serverPreferredPort);

const webPreferredPort = getPreferredPort(WEB_BASE_PORT, seed);
const webPort = await findAvailablePort(webPreferredPort, new Set([serverPort]));

const serverUrl = `http://localhost:${serverPort}`;
const wsUrl = `ws://localhost:${serverPort}/ws`;

console.log(`Instance: ${instanceId}`);
console.log(`Server:   ${serverUrl}`);
console.log(`Web:      http://localhost:${webPort}`);

const concurrently = spawn(
  "bunx",
  [
    "concurrently",
    "--kill-others-on-fail",
    "-n",
    "server,web",
    "-c",
    "blue,green",
    `PORT=${serverPort} bun run --filter @agent-canvas/server dev`,
    `AGENT_CANVAS_SERVER_URL=${serverUrl} AGENT_CANVAS_WEB_PORT=${webPort} VITE_AGENT_CANVAS_WS_URL=${wsUrl} bun run --filter web dev`,
  ],
  {
    stdio: "inherit",
    env: process.env,
  },
);

concurrently.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }

  process.exit(code ?? 1);
});
