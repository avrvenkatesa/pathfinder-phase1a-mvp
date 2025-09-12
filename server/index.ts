import { server } from "./app";
import { logger } from "./logger";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

function start() {
  server.listen(PORT, HOST, () => {
    logger.info({ port: PORT, host: HOST, env: process.env.NODE_ENV }, "server started");
  });

  process.on("unhandledRejection", (err) => {
    logger.error({ err }, "unhandledRejection");
  });

  process.on("uncaughtException", (err) => {
    logger.error({ err }, "uncaughtException");
    // optional: give the process a moment to flush logs
    setTimeout(() => process.exit(1), 50);
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutdown initiated");
    server.close((closeErr?: Error) => {
      if (closeErr) logger.error({ closeErr }, "error during server.close");
      process.exit(0);
    });
    // force-exit if clean shutdown hangs
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
