import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";
import { Hono } from "hono";

const execFileAsync = promisify(execFile);
const system = new Hono();

system.post("/pick-folder", async (c) => {
  if (process.platform !== "darwin") {
    return c.json({ error: "System folder picker is currently only supported on macOS." }, 501);
  }

  try {
    const { stdout } = await execFileAsync("osascript", [
      "-e",
      'POSIX path of (choose folder with prompt "Choose folder for agent commands")',
    ]);
    const rawPath = stdout.trim();
    const normalizedPath = rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath;

    if (!normalizedPath) {
      return c.json({ error: "No folder selected." }, 500);
    }

    return c.json({
      path: normalizedPath,
      name: basename(normalizedPath),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("User canceled")) {
      return c.json({ canceled: true });
    }
    return c.json({ error: "Could not open system folder picker." }, 500);
  }
});

export { system };
