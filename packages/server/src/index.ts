import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createApp } from "@/app";
import { removeLockfile, writeLockfile } from "@/lib/lockfile";
import { migrateSnapshotsToSync } from "@/lib/migrate-to-sync";
import { closeAllRooms } from "@/lib/rooms";
import { getBoardsDir, listDirs } from "@/lib/storage";
import {
  type SyncSocketData,
  addClient,
  removeClient,
  syncWebsocketHandler,
  websocketHandler,
} from "@/lib/ws";

export { createApp } from "@/app";
export {
  LOCKFILE_PATH,
  type LockfileData,
  readLockfile,
  removeLockfile,
  writeLockfile,
} from "@/lib/lockfile";
export { websocketHandler } from "@/lib/ws";

/** Migrate old "visual-markdown" shape types to "markdown" in all board snapshots. */
async function migrateSnapshots() {
  const boardsDir = getBoardsDir();
  const boardIds = await listDirs(boardsDir);

  for (const id of boardIds) {
    const snapshotPath = `${boardsDir}/${id}/snapshot.json`;
    try {
      const raw = await readFile(snapshotPath, "utf-8");
      if (raw.includes("visual-markdown")) {
        const migrated = raw.replaceAll("visual-markdown", "markdown");
        await writeFile(snapshotPath, migrated);
        console.log(
          `Migrated snapshot for board ${id}: visual-markdown → markdown`,
        );
      }
    } catch {
      // Snapshot doesn't exist or is unreadable — skip
    }
  }
}

// Socket data types for differentiating connection kinds
type EventSocketData = { kind: "events" };
type SocketData = EventSocketData | SyncSocketData;

// Only start server when run directly (not imported)
const isMain = import.meta.main;

if (isMain) {
  // Run data migrations before starting the server
  await migrateSnapshots();
  await migrateSnapshotsToSync();

  const app = createApp("./web");
  const port = Number(process.env.PORT) || 3456;

  const server = Bun.serve<SocketData>({
    fetch(req, server) {
      const url = new URL(req.url);

      // Sync WebSocket: /ws/sync/:roomId?sessionId=xxx
      if (url.pathname.startsWith("/ws/sync/")) {
        const roomId = url.pathname.slice("/ws/sync/".length);
        if (!roomId) {
          return new Response("Missing roomId", { status: 400 });
        }
        const sessionId =
          url.searchParams.get("sessionId") || randomUUID();

        const upgraded = server.upgrade(req, {
          data: { kind: "sync", roomId, sessionId } as SyncSocketData,
        });
        if (upgraded) return undefined;
        return new Response("WebSocket upgrade failed", { status: 500 });
      }

      // Event broadcast WebSocket: /ws
      if (url.pathname === "/ws") {
        const upgraded = server.upgrade(req, {
          data: { kind: "events" } as EventSocketData,
        });
        if (upgraded) return undefined;
        return new Response("WebSocket upgrade failed", { status: 500 });
      }

      return app.fetch(req);
    },
    websocket: {
      open(ws) {
        const data = ws.data as SocketData;
        if (data.kind === "sync") {
          syncWebsocketHandler.open(ws as any);
        } else {
          addClient(ws as any);
        }
      },
      close(ws) {
        const data = ws.data as SocketData;
        if (data.kind === "sync") {
          syncWebsocketHandler.close(ws as any);
        } else {
          removeClient(ws as any);
        }
      },
      message(ws, message) {
        const data = ws.data as SocketData;
        if (data.kind === "sync") {
          syncWebsocketHandler.message(ws as any, message as any);
        } else {
          websocketHandler.message(ws as any, message as any);
        }
      },
    },
    port,
  });

  const actualPort = server.port ?? port;
  const url = `http://localhost:${actualPort}`;

  writeLockfile({ pid: process.pid, port: actualPort, url });
  console.log(`Server running at ${url}`);

  // Handle graceful shutdown
  const cleanup = () => {
    closeAllRooms();
    removeLockfile();
    server.stop();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("SIGHUP", cleanup);
}
