import { createApp } from "@/app";
import { removeLockfile, writeLockfile } from "@/lib/lockfile";

export { createApp } from "@/app";
export {
  LOCKFILE_PATH,
  type LockfileData,
  readLockfile,
  removeLockfile,
  writeLockfile,
} from "@/lib/lockfile";

// Only start server when run directly (not imported)
const isMain = import.meta.main;

if (isMain) {
  const app = createApp("./web");
  const port = Number(process.env.PORT) || 3456;

  const server = Bun.serve({
    fetch(req) {
      return app.fetch(req);
    },
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
