import type { Express } from 'express';
import workflows from './workflows';
import instances from './instances';

export function registerRoutes(app: Express) {
  app.use('/api/workflows', workflows);
  app.use('/api/instances', instances);
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
}
