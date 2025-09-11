// server/index.ts
import type { Express } from 'express';
import workflows from './workflows';
import instances from './instances';
import { legacyErrorShim } from './middleware/legacy-error-shim';
import { notFoundHandler, errorHandler } from './middleware/error-handler';

/**
 * Register routes and global handlers on the provided Express app.
 * Order matters: shim -> routes -> 404 -> error handler.
 */
export function registerRoutes(app: Express) {
  // Wrap legacy error JSON into the canonical { error: { ... } } envelope
  app.use(legacyErrorShim);

  // Public health
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Feature routers
  app.use('/api/workflows', workflows);
  app.use('/api/instances', instances);

  // Global handlers (MUST be last)
  app.use(notFoundHandler);
  app.use(errorHandler);
}
