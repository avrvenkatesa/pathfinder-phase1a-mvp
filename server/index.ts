import { server } from "./app";
import { logger } from "./logger";
import { initializeWebSocket } from "./websocket";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

function start() {
  // Initialize WebSocket server
  const webSocketServer = initializeWebSocket(server);
  
  server.listen(PORT, HOST, () => {
    logger.info({ 
      port: PORT, 
      host: HOST, 
      env: process.env.NODE_ENV,
      websocket: true 
    }, "server started with WebSocket support");
  });

  process.on("unhandledRejection", (err) => {
    logger.error({ err }, "unhandledRejection");
  });

  process.on("uncaughtException", (err) => {
    logger.error({ err }, "uncaughtException");
    setTimeout(() => process.exit(1), 50);
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, shutting down gracefully");
    await webSocketServer.close();
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });
}

start();
