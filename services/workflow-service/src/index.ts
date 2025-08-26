import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { setupRoutes } from "./routes";
import { setupSwagger } from "./swagger";

const app = express();
const PORT = process.env.WORKFLOW_SERVICE_PORT || 3002;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for Swagger UI
  }),
);

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGINS?.split(",") || [
      "http://localhost:3000",
      "http://localhost:5000",
    ],
    credentials: true,
  }),
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan("combined"));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "workflow-service",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    uptime: process.uptime(),
    dependencies: {
      database: "healthy", // TODO: Implement actual database health check
    },
  });
});

// Setup Swagger documentation
setupSwagger(app);

// Setup API routes
setupRoutes(app);

// Global error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Unhandled error:", err);

    if (res.headersSent) {
      return next(err);
    }

    res.status(err.status || 500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "An internal server error occurred"
          : err.message,
    });
  },
);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "NOT_FOUND",
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Workflow Service running on port ${PORT}`);
  console.log(`📚 Swagger docs available at http://localhost:${PORT}/api-docs`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  process.exit(0);
});
