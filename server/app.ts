// server/app.ts
import express from "express";
import { createServer } from "http";
import pinoHttp from "pino-http";

// ✅ Canonical error pipeline
import { legacyErrorShim } from "./middleware/legacy-error-shim";
import { notFoundHandler, errorHandler } from "./middleware/error-handler";

// 🔗 Phase 1A routers (workflows/instances etc.)
import registerRoutes from "./appRoutes";

// 🔍 Observability baseline
import { logger } from "./logger";
import { requestContext } from "./middleware/requestContext";
import {
  httpMetrics,
  metricsHandler,
} from "./observability/metrics";

// -------------------------------------------------------------------------------------
// Build the app first — tests import this module and call request(app) immediately.
// -------------------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Observability: traceId + structured logging + metrics
app.use(requestContext());
app.use(
  pinoHttp({
    logger,
    genReqId: (_req, res) => (res.locals as any)?.traceId,
    customProps: (_req, res) => ({
      traceId: (res.locals as any)?.traceId,
      userId: (res.locals as any)?.userId ?? null,
    }),
  })
);
app.use(httpMetrics());

// Normalize any legacy JSON error bodies to the canonical envelope
app.use(legacyErrorShim);

// ---- Runtime routers (mounted synchronously) ----
// NOTE: registerRoutes is async in prod (due to auth setup). In tests we ensure it’s effectively sync.
void registerRoutes(app);

// ---- Public minimal health endpoints that don’t depend on v1 stack ----
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/metrics", metricsHandler);

// -------------------------------------------------------------------------------------
// Non-test: bring back the heavier stack (monitoring/session/cors/v1 controllers/etc.)
// We avoid importing those modules in test to keep things deterministic and fast.
// -------------------------------------------------------------------------------------
if (process.env.NODE_ENV !== "test") {
  // Use dynamic imports so tests don’t need these modules/types at runtime
  (async () => {
    try {
      const [
        { default: cors },
        { default: compression },
        { default: helmet },
        { default: session },
        { default: rateLimit },
        {
          initializeMonitoring,
          requestLogger,
          performanceMonitor,
          healthMonitor,
          metricsEndpoint,
        },
        {
          securityHeaders,
          requestIdMiddleware,
          rateLimiters,
          IPFilter,
          corsOptions,
        },
        { validate, contactSchemas },
        { cacheConfigs, invalidateCache, cacheAdmin },
        // import("./controllers/contacts"),
        // import("./controllers/bulk"),
        // import("./controllers/analytics"),
        // import("./controllers/workflow"),
      ] = await Promise.all([
        import("cors"),
        import("compression"),
        import("helmet"),
        import("express-session"),
        import("express-rate-limit"),
        import("./middleware/monitoring"),
        import("./middleware/security"),
        import("./middleware/validation"),
        import("./middleware/cache"),
      ]);

      // Minimal infra re-enable (safe defaults)
      const ipFilter = new IPFilter();

      // If you sit behind a proxy
      app.set("trust proxy", 1);

      // Existing non-test middleware
      app.use(requestIdMiddleware);
      app.use(requestLogger);
      app.use(performanceMonitor);
      app.use(ipFilter.middleware);
      app.use(securityHeaders);
      app.use(helmet());

      // CORS + compression
      app.use(cors(corsOptions));
      app.use(compression({ threshold: 1024 }));

      // Sessions (consider a store in prod)
      app.use(
        session({
          secret: process.env.SESSION_SECRET || "dev-secret",
          resave: false,
          saveUninitialized: false,
          cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
          },
        })
      );

      // Health & metrics (enhanced)
      app.get("/health", async (_req, res) => {
        const health = await healthMonitor.checkHealth();
        res
          .status(health.status === "healthy" ? 200 : 503)
          .json(health);
      });
      app.get("/metrics", rateLimiters.read, metricsEndpoint);

      // API v1 scaffold (kept, endpoints commented to avoid pulling controllers right now)
      const apiRouter = express.Router();

      apiRouter.get(
        "/contacts",
        rateLimiters.read,
        cacheConfigs.contactsList
      );
      apiRouter.get(
        "/contacts/stats",
        rateLimiters.read,
        cacheConfigs.contactStats
      );
      apiRouter.get(
        "/contacts/:id",
        rateLimiters.read,
        cacheConfigs.contactDetail
      );
      apiRouter.post(
        "/contacts",
        rateLimiters.write,
        invalidateCache(["contacts"]),
        validate(contactSchemas.create)
      );
      apiRouter.put(
        "/contacts/:id",
        rateLimiters.write,
        invalidateCache(["contacts"]),
        validate(contactSchemas.update)
      );
      apiRouter.delete(
        "/contacts/:id",
        rateLimiters.write,
        invalidateCache(["contacts"])
      );
      apiRouter.post(
        "/contacts/search",
        rateLimiters.read,
        cacheConfigs.searchResults,
        validate(contactSchemas.search)
      );

      app.use("/api/v1", apiRouter);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Non-test stack initialization failed:", e);
    }
  })();
}

// -------------------------------------------------------------------------------------
// Global fallthrough handlers — MUST be last
// -------------------------------------------------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

// Optionally export a Node server for non-test boot flows
const server = createServer(app);

export default app;
export { app, server };
