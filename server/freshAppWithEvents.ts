import express from "express";
import { createServer } from "http";
import { logger } from "./logger";

export const freshApp = express();
export const freshServer = createServer(freshApp);

// Request logging
freshApp.use((req, res, next) => {
  logger.info(`Fresh app received: ${req.method} ${req.path}`);
  next();
});

// API endpoints FIRST
freshApp.get('/api/instances', (req, res) => {
  res.json({message: "Fresh app instances endpoint", working: true});
});

freshApp.get('/api/runtime-dashboard/metrics', (req, res) => {
  res.json({
    system: {
      cpu: Math.round(Math.random() * 100),
      memory: Math.round(Math.random() * 100),
      uptime: Math.round(process.uptime()),
      requests: Math.floor(Math.random() * 1000) + 500
    },
    performance: {
      avgResponseTime: Math.round(Math.random() * 50) + 25,
      errorRate: (Math.random() * 2).toFixed(2),
      throughput: Math.floor(Math.random() * 100) + 50
    },
    timestamp: new Date().toISOString()
  });
});

freshApp.get('/api/runtime-dashboard/team-data', (req, res) => {
  res.json({
    totalMembers: 12, available: 8, busy: 3, offline: 1,
    performance: { overall: 94.5, thisWeek: 92.3, efficiency: 87.2 }
  });
});

freshApp.get('/api/runtime-dashboard/issues', (req, res) => {
  res.json([
    { id: 1, title: 'High CPU Usage on Server-01', severity: 'high', status: 'active' },
    { id: 2, title: 'Memory Leak in Contact Service', severity: 'medium', status: 'investigating' }
  ]);
});

freshApp.get('/api/runtime-dashboard/timeline', (req, res) => {
  res.json([
    { time: new Date().toISOString(), event: 'System Health Check', type: 'info' },
    { time: new Date(Date.now() - 1800000).toISOString(), event: 'Runtime Dashboard Testing', type: 'success' }
  ]);
});

// Vite integration with proper middleware
if (process.env.NODE_ENV !== 'production') {
  const setupVite = async () => {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: './client',
        configFile: './client/vite.config.ts'
      });
      
      // Add Vite middleware to handle all Vite internal routes
      freshApp.use(vite.ssrFixStacktrace);
      
      // Use Vite middleware but ONLY for non-API routes
      freshApp.use((req, res, next) => {
        if (req.path.startsWith('/api/')) {
          return next();
        }
        // Let Vite handle all non-API requests (including its internal routes)
        vite.middlewares(req, res, next);
      });
      
      logger.info('Vite middleware properly integrated');
    } catch (e) {
      logger.error('Failed to setup Vite:', e);
    }
  };
  
  setupVite();
}
