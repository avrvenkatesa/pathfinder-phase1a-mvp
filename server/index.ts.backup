// server/index.ts
import { app, server } from "./app";            // needs app + server exported
import { logger } from "./logger";
import { initializeWebSocket } from "./websocket";
import { registerRoutes } from "./appRoutes";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

/** Always-on health, independent of registerRoutes */
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

/** Best-effort check if a path is mounted */
function hasRoute(path: string): boolean {
  const stack = (app as any)?._router?.stack ?? [];
  return stack.some((layer: any) => layer?.route?.path === path);
}

/** Canary to verify routes mounted */
app.get("/__canary", (_req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV,
    routes: {
      apiHealth: hasRoute("/api/health"),
    },
    uptimeSec: process.uptime(),
  });
});

async function start() {
  // Try to mount app routes
  try {
    await registerRoutes(app);
    logger.info("[routes] registerRoutes completed");
  } catch (err) {
    logger.error({ err }, "[boot] registerRoutes failed");
  }

  // Initialize WebSocket server
  const webSocketServer = initializeWebSocket(server);

  server.listen(PORT, HOST, () => {
    logger.info(
      { port: PORT, host: HOST, env: process.env.NODE_ENV, websocket: true },
      "server started with WebSocket support"
    );
  });

  process.on("unhandledRejection", (err) => {
    logger.error({ err }, "unhandledRejection");
  });
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "uncaughtException");
    setTimeout(() => process.exit(1), 50);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutdown requested, closing gracefully");
    try {
      await webSocketServer.close();
    } catch (e) {
      logger.warn({ err: e }, "error closing websocket server");
    }
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start();
