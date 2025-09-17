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
