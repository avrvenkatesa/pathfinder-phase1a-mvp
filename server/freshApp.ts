import express from 'express';
import { createServer } from 'http';
import { logger } from './logger';

// Create completely fresh Express instance
const freshApp = express();

// Basic middleware only
freshApp.use(express.json());
freshApp.use(express.urlencoded({ extended: true }));

// Simple logging middleware to verify requests are reaching the app
freshApp.use((req, _res, next) => {
  logger.info(`Fresh app received: ${req.method} ${req.path}`);
  next();
});

// Test if basic route registration works on fresh instance
freshApp.get('/test/basic', (_req, res) => {
  res.json({ message: 'Fresh Express app working', timestamp: new Date() });
});

// Test programmatic route registration
function addTestRoutes(app: express.Express) {
  logger.info('Adding test routes to fresh app');
  
  app.get('/api/instances', (_req, res) => {
    res.json({ 
      message: 'Fresh app instances endpoint',
      working: true,
      timestamp: new Date()
    });
  });
  
  app.get('/api/test/health', (_req, res) => {
    res.json({ 
      message: 'Fresh app health check',
      status: 'ok'
    });
  });
  
  logger.info('Test routes added to fresh app');
}

// Add routes programmatically
addTestRoutes(freshApp);

// Create server
const freshServer = createServer(freshApp);

export { freshApp, freshServer };

// Add convenience endpoints functionality
freshApp.post('/api/instances/:instanceId/steps/:stepId/advance', async (req, res) => {
  const { instanceId, stepId } = req.params;
  
  // Simple test response - replace with actual service calls once working
  res.json({
    message: 'Step advanced successfully',
    instanceId,
    stepId,
    status: 'in_progress',
    timestamp: new Date()
  });
});

freshApp.post('/api/instances/:instanceId/steps/:stepId/complete', async (req, res) => {
  const { instanceId, stepId } = req.params;
  
  res.json({
    message: 'Step completed successfully',
    instanceId,
    stepId,
    status: 'completed',
    timestamp: new Date()
  });
});

// Add workflow routes
freshApp.get('/api/workflows', (_req, res) => {
  res.json({
    message: 'Workflows endpoint working',
    workflows: [],
    timestamp: new Date()
  });
});
