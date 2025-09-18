import express from 'express';
import { createServer } from 'http';
import { logger } from './logger';
import { getEventPublisher, createEvent } from './events/publisher';

const freshApp = express();

// Basic middleware
freshApp.use(express.json());
freshApp.use(express.urlencoded({ extended: true }));

// Logging middleware
freshApp.use((req, _res, next) => {
  logger.info(`Fresh app received: ${req.method} ${req.path}`);
  next();
});

// Basic routes
freshApp.get('/test/basic', (_req, res) => {
  res.json({ message: 'Fresh Express app working', timestamp: new Date() });
});

freshApp.get('/api/instances', (_req, res) => {
  res.json({ message: 'Fresh app instances endpoint', working: true });
});

// Convenience endpoints with WebSocket event publishing
freshApp.post('/api/instances/:instanceId/steps/:stepId/advance', async (req, res) => {
  const { instanceId, stepId } = req.params;
  
  try {
    // Publish WebSocket event
    const eventPublisher = getEventPublisher();
    const event = createEvent.stepAdvanced(instanceId, stepId, 'in_progress', 'pending');
    await eventPublisher.publish(event);
    await eventPublisher.publishToRoom(`instance:${instanceId}`, event);
    
    res.json({
      message: 'Step advanced successfully',
      instanceId,
      stepId,
      status: 'in_progress',
      eventPublished: true,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error in advance endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

freshApp.post('/api/instances/:instanceId/steps/:stepId/complete', async (req, res) => {
  const { instanceId, stepId } = req.params;
  
  try {
    // Publish WebSocket event
    const eventPublisher = getEventPublisher();
    const event = createEvent.stepCompleted(instanceId, stepId, new Date());
    await eventPublisher.publish(event);
    await eventPublisher.publishToRoom(`instance:${instanceId}`, event);
    
    res.json({
      message: 'Step completed successfully',
      instanceId,
      stepId,
      status: 'completed',
      eventPublished: true,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error in complete endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const freshServer = createServer(freshApp);
export { freshApp, freshServer };

// Add Vite development server for frontend routes
if (process.env.NODE_ENV !== 'production') {
  (async () => {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: 'client'
      });
      
      freshApp.use(vite.ssrFixStacktrace);
      
      // Handle frontend routes - must be after API routes
      freshApp.use('*', async (req, res, next) => {
        const url = req.originalUrl;
        
        // Skip API routes
        if (url.startsWith('/api/')) {
          return next();
        }
        
        try {
          // Serve index.html for all non-API routes
          const template = await vite.transformIndexHtml(url, `
            <!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Pathfinder Dashboard</title>
              </head>
              <body>
                <div id="root"></div>
                <script type="module" src="/src/main.tsx"></script>
              </body>
            </html>
          `);
          
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace(e);
          next(e);
        }
      });
      
      logger.info('Vite development server integrated');
    } catch (e) {
      logger.error('Failed to setup Vite:', e);
    }
  })();
}

// Frontend serving for Issue #15 - Runtime Dashboard
if (process.env.NODE_ENV !== 'production') {
  const setupViteFrontend = async () => {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: './client'
      });
      
      freshApp.use(vite.ssrFixStacktrace);
      
      // Serve frontend routes (after API routes)
      freshApp.use('*', async (req, res, next) => {
        const url = req.originalUrl;
        
        // Skip API routes - let them 404 naturally
        if (url.startsWith('/api/')) {
          return next();
        }
        
        try {
          // Transform and serve the HTML for all non-API routes
          const template = await vite.transformIndexHtml(url, `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pathfinder Runtime Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`);
          
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace(e);
          next(e);
        }
      });
      
      logger.info('Frontend Vite server integrated for Issue #15');
    } catch (e) {
      logger.error('Failed to setup frontend serving:', e);
    }
  };
  
  // Setup frontend after a brief delay to ensure other routes are registered first
  setTimeout(setupViteFrontend, 100);
}

// Runtime Dashboard API Endpoints for Issue #15
freshApp.get('/api/runtime-dashboard/metrics', (req, res) => {
  logger.info('Fresh app received: GET /api/runtime-dashboard/metrics');
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
  logger.info('Fresh app received: GET /api/runtime-dashboard/team-data');
  res.json({
    totalMembers: 12,
    available: 8,
    busy: 3,
    offline: 1,
    performance: {
      overall: 94.5,
      thisWeek: 92.3,
      efficiency: 87.2
    }
  });
});

freshApp.get('/api/runtime-dashboard/issues', (req, res) => {
  logger.info('Fresh app received: GET /api/runtime-dashboard/issues');
  res.json([
    { 
      id: 1, 
      title: 'High CPU Usage on Server-01', 
      severity: 'high', 
      status: 'active'
    },
    { 
      id: 2, 
      title: 'Memory Leak in Contact Service', 
      severity: 'medium', 
      status: 'investigating'
    }
  ]);
});

freshApp.get('/api/runtime-dashboard/timeline', (req, res) => {
  logger.info('Fresh app received: GET /api/runtime-dashboard/timeline');
  res.json([
    {
      time: new Date().toISOString(),
      event: 'System Health Check',
      type: 'info'
    },
    {
      time: new Date(Date.now() - 1800000).toISOString(),
      event: 'Runtime Dashboard Testing',
      type: 'success'
    }
  ]);
});

// Runtime Dashboard API Endpoints for Issue #15
freshApp.get('/api/runtime-dashboard/metrics', (req, res) => {
  logger.info('Fresh app received: GET /api/runtime-dashboard/metrics');
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
  logger.info('Fresh app received: GET /api/runtime-dashboard/team-data');
  res.json({
    totalMembers: 12,
    available: 8,
    busy: 3,
    offline: 1,
    performance: {
      overall: 94.5,
      thisWeek: 92.3,
      efficiency: 87.2
    }
  });
});

freshApp.get('/api/runtime-dashboard/issues', (req, res) => {
  logger.info('Fresh app received: GET /api/runtime-dashboard/issues');
  res.json([
    { 
      id: 1, 
      title: 'High CPU Usage on Server-01', 
      severity: 'high', 
      status: 'active'
    },
    { 
      id: 2, 
      title: 'Memory Leak in Contact Service', 
      severity: 'medium', 
      status: 'investigating'
    }
  ]);
});

freshApp.get('/api/runtime-dashboard/timeline', (req, res) => {
  logger.info('Fresh app received: GET /api/runtime-dashboard/timeline');
  res.json([
    {
      time: new Date().toISOString(),
      event: 'System Health Check',
      type: 'info'
    },
    {
      time: new Date(Date.now() - 1800000).toISOString(),
      event: 'Runtime Dashboard Testing',
      type: 'success'
    }
  ]);
});

logger.info('Runtime Dashboard API endpoints added for Issue #15');
