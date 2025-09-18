import { Express } from 'express';
import { logger } from './logger';

// Simple test routes to verify basic functionality
export function registerSimpleRoutes(app: Express): void {
  logger.info("[simple-routes] Starting route registration");

  // Test route 1: Basic health
  app.get('/api/test/health', (_req, res) => {
    res.json({ message: 'Simple routes working', timestamp: new Date().toISOString() });
  });

  // Test route 2: Echo endpoint
  app.post('/api/test/echo', (req, res) => {
    res.json({ echo: req.body, received: new Date().toISOString() });
  });

  // Test route 3: Simple instances endpoint (no auth for now)
  app.get('/api/instances', (_req, res) => {
    res.json({ 
      message: 'Simple instances endpoint working',
      test: true,
      routes: ['GET /api/instances']
    });
  });

  logger.info("[simple-routes] Route registration completed");
}
