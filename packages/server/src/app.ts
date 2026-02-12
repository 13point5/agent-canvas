import { join } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";

import { getBoardAssetsDir } from "@/lib/storage";
import { getClientCount } from "@/lib/ws";
import { boards } from "@/routes/boards";

export function createApp(webDir?: string) {
  const app = new Hono();

  // Enable CORS for development
  app.use("/api/*", cors());

  // Health check with WebSocket client count
  app.get("/api/health", (c) =>
    c.json({ status: "ok", clients: getClientCount() }),
  );

  // Serve board assets (images)
  app.get("/api/boards/:boardId/assets/:filename", async (c) => {
    const { boardId, filename } = c.req.param();
    const filePath = join(getBoardAssetsDir(boardId), filename);
    const file = Bun.file(filePath);
    if (!(await file.exists())) return c.notFound();
    return new Response(file, {
      headers: { "Content-Type": file.type },
    });
  });

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
