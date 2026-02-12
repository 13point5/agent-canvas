import { join, resolve, relative } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";

import { getBoardAssetsDir } from "@/lib/storage";
import { getClientCount } from "@/lib/ws";
import { boards } from "@/routes/boards";

const LANG_MAP: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  py: "python", rb: "ruby", rs: "rust", go: "go", java: "java",
  css: "css", html: "html", json: "json", yaml: "yaml", yml: "yaml",
  md: "markdown", sh: "bash", bash: "bash", sql: "sql",
  graphql: "graphql", c: "c", cpp: "cpp", h: "c", hpp: "cpp",
  swift: "swift", kt: "kotlin", scala: "scala", r: "r",
  toml: "toml", xml: "xml", svg: "xml",
};

export function createApp(webDir?: string) {
  const app = new Hono();

  // Enable CORS for development
  app.use("/api/*", cors());

  // Health check with WebSocket client count
  app.get("/api/health", (c) =>
    c.json({ status: "ok", clients: getClientCount() }),
  );

  // File reading endpoint for visual-markdown code panel
  app.get("/api/files", async (c) => {
    const path = c.req.query("path");
    if (!path) return c.json({ error: "path is required" }, 400);

    // Prevent directory traversal
    const cwd = process.cwd();
    const resolved = resolve(cwd, path);
    const rel = relative(cwd, resolved);
    if (rel.startsWith("..") || resolve(resolved) !== resolved.replace(/\/$/, "")) {
      return c.json({ error: "Invalid path" }, 400);
    }

    try {
      const file = Bun.file(resolved);
      if (!(await file.exists())) {
        return c.json({ error: "File not found" }, 404);
      }

      let content = await file.text();

      const startLine = c.req.query("startLine");
      const endLine = c.req.query("endLine");
      if (startLine) {
        const lines = content.split("\n");
        const start = Math.max(0, parseInt(startLine, 10) - 1);
        const end = endLine ? parseInt(endLine, 10) : lines.length;
        content = lines.slice(start, end).join("\n");
      }

      const ext = path.split(".").pop()?.toLowerCase() ?? "";
      const language = LANG_MAP[ext] ?? ext;

      return c.json({ content, language });
    } catch {
      return c.json({ error: "Failed to read file" }, 500);
    }
  });

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
