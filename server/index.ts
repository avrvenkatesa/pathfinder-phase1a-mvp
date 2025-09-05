// server/index.ts
import express, { type Request, Response, NextFunction } from "express";
import registerRoutes from "./appRoutes"; // default export
import { setupVite, serveStatic, log } from "./vite";

export const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Lightweight API logger that captures JSON response bodies
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json.bind(res);
  (res as any).json = (bodyJson: any) => {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } catch {
          // ignore stringify issues
        }
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

// Centralized error handler (kept identical to your behavior, with an error code)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ error: "InternalServerError", message });
  // rethrow for visibility in dev logs if you want:
  // throw err;
});

/**
 * Build routes + environment-specific middleware.
 * - In development: attach Vite to the Node server.
 * - In production: serve static assets.
 * - In test: skip Vite & static; just ensure routes are registered.
 *
 * We export a promise so tests can await readiness if needed.
 */
export const appReady: Promise<import("node:http").Server | null> = (async () => {
  // registerRoutes typically returns the Node http.Server used by Vite/HMR
  const server = await registerRoutes(app);

  const env = process.env.NODE_ENV ?? app.get("env");

  if (env === "development") {
    await setupVite(app, server);
  } else if (env === "production") {
    serveStatic(app);
  } else {
    // test or other envs: no Vite/static
  }

  return server ?? null;
})();

// Only start the listener outside of tests
(async () => {
  if (process.env.NODE_ENV === "test") return;

  try {
    const server = (await appReady) as import("node:http").Server | null;
    const httpServer = server ?? require("node:http").createServer(app);

    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log(`serving on port ${port}`);
      }
    );
  } catch (err) {
    console.error("[server] failed to start:", err);
    process.exit(1);
  }
})();
