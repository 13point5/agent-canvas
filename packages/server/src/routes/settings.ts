import { join } from "node:path";
import { type AppSettings, appSettingsSchema } from "@agent-canvas/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { getDataDir, readJSON, writeJSON } from "@/lib/storage";

const settings = new Hono();

function getSettingsPath(): string {
  return join(getDataDir(), "settings.json");
}

// Get app settings
settings.get("/", async (c) => {
  const data = await readJSON<AppSettings>(getSettingsPath());
  return c.json(data ?? {});
});

// Update app settings (partial merge)
settings.patch(
  "/",
  zValidator("json", appSettingsSchema.partial()),
  async (c) => {
    const patch = c.req.valid("json");
    const existing = (await readJSON<AppSettings>(getSettingsPath())) ?? {};
    const merged = { ...existing, ...patch };
    await writeJSON(getSettingsPath(), merged);
    return c.json(merged);
  },
);

export { settings };
