import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const serverTarget = process.env.AGENT_CANVAS_SERVER_URL ?? "http://localhost:3456";
const wsTarget = serverTarget.replace(/^http/i, "ws");
const parsedWebPort = Number.parseInt(process.env.AGENT_CANVAS_WEB_PORT ?? "", 10);
const webPort = Number.isNaN(parsedWebPort) ? 1305 : parsedWebPort;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: webPort,
    strictPort: false,
    proxy: {
      "/api": {
        target: serverTarget,
        changeOrigin: true,
      },
      "/ws": {
        target: wsTarget,
        ws: true,
      },
    },
  },
});
