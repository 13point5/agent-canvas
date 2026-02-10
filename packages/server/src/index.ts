import { createApp } from "@/app";
import { removeLockfile, writeLockfile } from "@/lib/lockfile";
import { websocketHandler } from "@/lib/ws";

export { createApp } from "@/app";
export {
  LOCKFILE_PATH,
  type LockfileData,
  readLockfile,
  removeLockfile,
  writeLockfile,
} from "@/lib/lockfile";
export { websocketHandler } from "@/lib/ws";

// Only start server when run directly (not imported)
const isMain = import.meta.main;

if (isMain) {
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
