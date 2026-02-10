import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 1305,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://localhost:3456",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3456",
        ws: true,
      },
    },
  },
});
