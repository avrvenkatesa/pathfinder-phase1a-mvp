import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api/auth": {
        target: "http://localhost:3003", // Auth service
        changeOrigin: true,
        secure: false,
      },
      "/api/contact": {
        target: "http://localhost:3001", // Contact service
        changeOrigin: true,
        secure: false,
      },
      "/api/workflow": {
        target: "http://localhost:3002", // Workflow service
        changeOrigin: true,
        secure: false,
      },
      "/api": {
        target: "http://localhost:3000", // API Gateway fallback
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
