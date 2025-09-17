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
import { httpMetrics, metricsHandler } from "./observability/metrics";

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

// Helper: check if a specific method is mounted for a path
function hasRouteMethod(path: string, method: string): boolean {
  const stack = (app as any)?._router?.stack ?? [];
  method = method.toLowerCase();
  return stack.some((layer: any) => {
    const r = layer?.route;
    return r && r.path === path && r.methods && !!r.methods[method];
  });
}

// ---- Always-on minimal health endpoints ----
app.get("/healthz", (_req, res) => res.status(200).send("ok")); // boot-level
app.get("/health", (_req, res) => res.json({ ok: true }));      // minimal health
app.get("/metrics", metricsHandler);

// Ensure /api/health exists even if registerRoutes fails or is delayed
// GET fallback that yields to the real route once routes are mounted
app.get("/api/health", (_req, res, next) => {
  if ((globalThis as any).__routesMounted) return next("route"); // skip to next matching route
  res.json({ ok: true, source: "app.ts" });
});
// HEAD fallback (always safe to return 200)
if (!hasRouteMethod("/api/health", "head")) {
  app.head("/api/health", (_req, res) => res.sendStatus(200));
}

// ---- Mount app routes BEFORE 404/error handlers ----
let routesMounted = false;
registerRoutes(app)
  .then(() => {
    routesMounted = true;
    (globalThis as any).__routesMounted = true;
    logger.info("[routes] registerRoutes completed");
  })
  .catch((err) => {
    logger.error({ err }, "[boot] registerRoutes failed");
  });

// Canary endpoint to verify routing status + methods
app.get("/__canary", (_req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV,
    routesMounted,
    routes: {
      healthz_GET: hasRouteMethod("/healthz", "GET"),
      apiHealth_GET: hasRouteMethod("/api/health", "GET"),
      apiHealth_HEAD: hasRouteMethod("/api/health", "HEAD"),
    },
    uptimeSec: process.uptime(),
  });
});

// -------------------------------------------------------------------------------------
// Non-test heavy stack (monitoring/session/cors/etc.)
// -------------------------------------------------------------------------------------
if (process.env.NODE_ENV !== "test") {
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

      const ipFilter = new IPFilter();
      app.set("trust proxy", 1);

      app.use(requestIdMiddleware);
      app.use(requestLogger);
      app.use(performanceMonitor);
      app.use(ipFilter.middleware);
      app.use(securityHeaders);
      app.use(helmet());

      app.use(cors(corsOptions));
      app.use(compression({ threshold: 1024 }));

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

      // Enhanced health & metrics
      app.get("/health", async (_req, res) => {
        const health = await healthMonitor.checkHealth();
        res.status(health.status === "healthy" ? 200 : 503).json(health);
      });
      app.get("/metrics", rateLimiters.read, metricsEndpoint);

      // API v1 scaffold (controllers intentionally not imported here)
      const apiRouter = express.Router();
      apiRouter.get("/contacts", rateLimiters.read, cacheConfigs.contactsList);
      apiRouter.get("/contacts/stats", rateLimiters.read, cacheConfigs.contactStats);
      apiRouter.get("/contacts/:id", rateLimiters.read, cacheConfigs.contactDetail);
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

// Export both app and server
const server = createServer(app);
export default app;
export { app, server };
