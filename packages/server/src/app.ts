import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";

import { boards } from "@/routes/boards";

export function createApp(webDir?: string) {
  const app = new Hono();

  // Enable CORS for development
  app.use("/api/*", cors());

  // API routes
  app.route("/api/boards", boards);

  // Static files (SPA) - served from bundled web assets
  if (webDir) {
    // Serve static assets (js, css, images, etc.)
    app.use("/assets/*", serveStatic({ root: webDir }));

    // SPA fallback - serve index.html for all routes (let React Router handle routing)
    app.get("*", async (c) => {
      const indexPath = `${webDir}/index.html`;
      const file = Bun.file(indexPath);

      if (await file.exists()) {
        const content = await file.text();
        return c.html(content);
      }

      return c.text("Not Found", 404);
    });
  }

  return app;
}
