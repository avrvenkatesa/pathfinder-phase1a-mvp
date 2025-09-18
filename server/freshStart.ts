import { freshApp, freshServer } from './freshAppWithEvents';
import { logger } from './logger';
import { initializeWebSocket } from './websocket';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

async function start() {
  try {
    // Initialize WebSocket with fresh server
    const webSocketServer = initializeWebSocket(freshServer);
    
    // Start fresh server
    freshServer.listen(PORT, HOST, () => {
      logger.info({ 
        port: PORT, 
        host: HOST,
        type: 'fresh-express-app-with-events'
      }, "Fresh Express server with WebSocket events started");
    });

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      logger.info("Shutting down fresh server");
      await webSocketServer.close();
      freshServer.close(() => process.exit(0));
    });

  } catch (err) {
    logger.error({ err }, "Fresh server startup failed");
    process.exit(1);
  }
}

start();
