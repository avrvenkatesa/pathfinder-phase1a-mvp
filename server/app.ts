// server/app.ts
import express from "express";
import { createServer } from "http";

// ✅ Canonical error pipeline
import { legacyErrorShim } from "./middleware/legacy-error-shim";
import { notFoundHandler, errorHandler } from "./middleware/error-handler";

// 🔗 Phase 1A routers (workflows/instances etc.)
import registerRoutes from "./appRoutes";

// -------------------------------------------------------------------------------------
// Build the app first — tests import this module and call request(app) immediately.
// -------------------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Normalize any legacy JSON error bodies to the canonical envelope
app.use(legacyErrorShim);

// ---- Runtime routers (mounted synchronously) ----
// NOTE: registerRoutes is async in prod (due to auth setup). In tests we ensure it’s effectively sync.
void registerRoutes(app);

// ---- Public minimal health endpoints that don’t depend on v1 stack ----
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/metrics", (_req, res) => res.json({ ok: true, metrics: {} }));

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
        { initializeMonitoring, requestLogger, performanceMonitor, healthMonitor, metricsEndpoint },
        { securityHeaders, requestIdMiddleware, rateLimiters, IPFilter, corsOptions },
        { validate, contactSchemas },
        { cacheConfigs, invalidateCache, cacheAdmin },
        // Controllers (commented endpoints below show where they’d be wired)
        // contactsController, bulkController, analyticsController, workflowController
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
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
        // import("./controllers/contacts"),
        // import("./controllers/bulk"),
        // import("./controllers/analytics"),
        // import("./controllers/workflow"),
      ]);

      // Minimal infra re-enable (safe defaults)
      const ipFilter = new IPFilter();

      // If you sit behind a proxy
      app.set("trust proxy", 1);

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
        res.status(health.status === "healthy" ? 200 : 503).json(health);
      });
      app.get("/metrics", rateLimiters.read, metricsEndpoint);

      // API v1 scaffold (kept, endpoints commented to avoid pulling controllers right now)
      const apiRouter = express.Router();

      // Contacts
      apiRouter.get("/contacts", rateLimiters.read, cacheConfigs.contactsList /*, contactsController.listContacts */);
      apiRouter.get("/contacts/stats", rateLimiters.read, cacheConfigs.contactStats /*, contactsController.getContactStats */);
      apiRouter.get("/contacts/:id", rateLimiters.read, cacheConfigs.contactDetail /*, contactsController.getContact */);
      apiRouter.post(
        "/contacts",
        rateLimiters.write,
        invalidateCache(["contacts"]),
        validate(contactSchemas.create)
        /*, contactsController.createContact */
      );
      apiRouter.put(
        "/contacts/:id",
        rateLimiters.write,
        invalidateCache(["contacts"]),
        validate(contactSchemas.update)
        /*, contactsController.updateContact */
      );
      apiRouter.delete(
        "/contacts/:id",
        rateLimiters.write,
        invalidateCache(["contacts"])
        /*, contactsController.deleteContact */
      );

      // Search
      apiRouter.post(
        "/contacts/search",
        rateLimiters.read,
        cacheConfigs.searchResults,
        validate(contactSchemas.search)
        /*, contactsController.searchContacts */
      );

      // Bulk
      // apiRouter.post("/contacts/bulk", rateLimiters.bulk, invalidateCache(["contacts"]), bulkController.bulkCreateContacts);
      // apiRouter.put("/contacts/bulk", rateLimiters.bulk, invalidateCache(["contacts"]), bulkController.bulkUpdateContacts);
      // apiRouter.delete("/contacts/bulk", rateLimiters.bulk, invalidateCache(["contacts"]), bulkController.bulkDeleteContacts);

      // Analytics / Workflow (Phase 1B prep)
      // apiRouter.get("/analytics/contacts", rateLimiters.read, cacheConfigs.analytics, analyticsController.getContactAnalytics);
      // apiRouter.post("/workflow/contacts/match", rateLimiters.read, workflowController.findMatchingContacts);
      // apiRouter.post("/workflow/capacity/analyze", rateLimiters.read, workflowController.analyzeTeamCapacity);

      app.use("/api/v1", apiRouter);
    } catch (e) {
      // If something in the non-test stack blows up, keep the runtime routes usable
      // and let the global error handler report it if hit.
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
