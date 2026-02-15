import { readFile, writeFile } from "node:fs/promises";
import { createApp } from "@/app";
import { removeLockfile, writeLockfile } from "@/lib/lockfile";
import { getBoardsDir, listDirs } from "@/lib/storage";
import { websocketHandler } from "@/lib/ws";

export { createApp } from "@/app";
export {
  DEFAULT_INSTANCE_ID,
  getInstanceId,
  getLockfilePath,
  INSTANCE_ENV_VAR,
  LEGACY_LOCKFILE_PATH,
  LOCKFILE_DIR,
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
        console.log(`Migrated snapshot for board ${id}: visual-markdown → markdown`);
      }
    } catch {
      // Snapshot doesn't exist or is unreadable — skip
    }
  }
}

// Only start server when run directly (not imported)
const isMain = import.meta.main;

if (isMain) {
  // Run data migrations before starting the server
  await migrateSnapshots();

  const app = createApp("./web");
  const port = Number(process.env.PORT) || 3456;

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
      return app.fetch(req);
    },
    websocket: websocketHandler,
    port,
  });

  const actualPort = server.port ?? port;
  const url = `http://localhost:${actualPort}`;

  writeLockfile({ pid: process.pid, port: actualPort, url });
  console.log(`Server running at ${url}`);

  // Handle graceful shutdown
  const cleanup = () => {
    removeLockfile();
    server.stop();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("SIGHUP", cleanup);
}
