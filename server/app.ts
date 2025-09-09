// server/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet'; // (kept; your securityHeaders may already set most headers)
import compression from 'compression';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';

import { getDatabase, closeDatabasePool } from './config/database.js';
import config, { validateConfig } from './config/env';
import { errorHandler, notFoundHandler, asyncHandler } from './middleware/errorHandler.js';
import {
  requestLogger,
  performanceMonitor,
  initializeMonitoring,
  healthMonitor,
  metricsEndpoint
} from './middleware/monitoring.js';
import {
  securityHeaders,
  requestIdMiddleware,
  rateLimiters,
  IPFilter,
  corsOptions
} from './middleware/security.js';
import { validate, contactSchemas } from './middleware/validation.js';
import { cacheConfigs, invalidateCache, cacheAdmin } from './middleware/cache.js';

// Controllers (contacts/analytics/workflow prep)
import * as contactsController from './controllers/contacts.js';
import * as bulkController from './controllers/bulk.js';
import * as analyticsController from './controllers/analytics.js';
import * as workflowController from './controllers/workflow.js';

// Phase 1A routers (workflows/instances/etc.)
import registerRoutes from './appRoutes'; // mounts workflows + instances family

// WebSocket service — initialize it on the *same* HTTP server we export
import { contactWebSocketService } from './services/websocketService';

// Validate configuration on startup
validateConfig();

// Create Express app/server
const app = express();
const server = createServer(app);

// Initialize monitoring
initializeMonitoring();

// IP filtering
const ipFilter = new IPFilter();

// Trust proxy (for load balancers)
if (config.server.trustProxy) {
  app.set('trust proxy', 1);
}

// Global middleware
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(performanceMonitor);
app.use(ipFilter.middleware);
app.use(securityHeaders);
app.use(compression(config.performance.compression));
// If you maintain a dedicated corsOptions export, use that instead of config.security.cors
app.use(cors(config.security.cors));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(
  session({
    secret: config.security.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: config.security.session,
    // In production, add a session store (e.g., Redis)
  })
);

// ──────────────────────────────────────────────────────────────────────────────
// Health and monitoring
// ──────────────────────────────────────────────────────────────────────────────
app.get(
  '/health',
  asyncHandler(async (_req: any, res: any) => {
    const health = await healthMonitor.checkHealth();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  })
);

app.get('/metrics', rateLimiters.read, metricsEndpoint);

// Cache administration (dev/staging)
if (config.server.environment !== 'production') {
  app.get('/cache/status', cacheAdmin.status);
  app.delete('/cache', cacheAdmin.clear);
  app.delete('/cache/tags/:tag', cacheAdmin.invalidateTag);

  // API docs helpers
  app.get('/api-docs', (_req, res) => res.redirect('/api/docs'));
  app.get('/api/docs/openapi.yaml', (_req, res) =>
    res.sendFile('docs/openapi.yaml', { root: './server' })
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// API v1 routes (contacts/analytics/workflow prep)
// ──────────────────────────────────────────────────────────────────────────────
const apiRouter = express.Router();

// Contacts (controllers commented where intentionally stubbed in your current setup)
apiRouter.get('/contacts', rateLimiters.read, cacheConfigs.contactsList /*, contactsController.listContacts */);
apiRouter.get('/contacts/stats', rateLimiters.read, cacheConfigs.contactStats /*, contactsController.getContactStats */);
apiRouter.get('/contacts/:id', rateLimiters.read, cacheConfigs.contactDetail /*, contactsController.getContact */);
apiRouter.post(
  '/contacts',
  rateLimiters.write,
  invalidateCache(['contacts']),
  validate(contactSchemas.create)
  /*, contactsController.createContact */
);
apiRouter.put(
  '/contacts/:id',
  rateLimiters.write,
  invalidateCache(['contacts']),
  validate(contactSchemas.update)
  /*, contactsController.updateContact */
);
apiRouter.delete('/contacts/:id', rateLimiters.write, invalidateCache(['contacts']) /*, contactsController.deleteContact */);

// Search
apiRouter.post(
  '/contacts/search',
  rateLimiters.read,
  cacheConfigs.searchResults,
  validate(contactSchemas.search)
  /*, contactsController.searchContacts */
);

// Bulk
apiRouter.post('/contacts/bulk', rateLimiters.bulk, invalidateCache(['contacts']), bulkController.bulkCreateContacts);
apiRouter.put('/contacts/bulk', rateLimiters.bulk, invalidateCache(['contacts']), bulkController.bulkUpdateContacts);
apiRouter.delete('/contacts/bulk', rateLimiters.bulk, invalidateCache(['contacts']), bulkController.bulkDeleteContacts);

// File upload (bulk import)
// NOTE: add multer middleware when you wire real upload handling
apiRouter.post('/contacts/import/csv', rateLimiters.bulk, invalidateCache(['contacts']) /*, multer middleware */, bulkController.bulkImportCSV);

// Relationships
apiRouter.post(
  '/relationships/bulk',
  rateLimiters.bulk,
  invalidateCache(['contacts', 'relationships']),
  bulkController.bulkAssignRelationships
);

// Analytics
apiRouter.get('/analytics/contacts', rateLimiters.read, cacheConfigs.analytics, analyticsController.getContactAnalytics);
apiRouter.get('/analytics/activity', rateLimiters.read, analyticsController.getActivityAnalytics);
apiRouter.get('/analytics/performance', rateLimiters.read, analyticsController.getPerformanceAnalytics);
apiRouter.get('/analytics/engagement', rateLimiters.read, analyticsController.getEngagementMetrics);
apiRouter.get('/analytics/capacity', rateLimiters.read, analyticsController.getCapacityMetrics);
apiRouter.post('/analytics/reports/custom', rateLimiters.write, analyticsController.generateCustomReport);

// Workflow (Phase 1B prep)
apiRouter.post('/workflow/contacts/match', rateLimiters.read, workflowController.findMatchingContacts);
apiRouter.post('/workflow/capacity/analyze', rateLimiters.read, workflowController.analyzeTeamCapacity);
apiRouter.post('/workflow/assignments/simulate', rateLimiters.write, workflowController.simulateWorkflowAssignment);
apiRouter.get('/workflow/assignments/history', rateLimiters.read, workflowController.getWorkflowAssignmentHistory);

// Mount API v1
app.use('/api/v1', apiRouter);

// ──────────────────────────────────────────────────────────────────────────────
// Phase 1A Routers (workflows/instances): ensure they are mounted BEFORE 404
// Use top-level await so tests don’t race and hit 404s.
// ──────────────────────────────────────────────────────────────────────────────
await registerRoutes(app);

// Initialize websockets on the HTTP server we actually export
contactWebSocketService.initialize(server);

// Global rate limiter for everything else
app.use(rateLimiters.general);

// 404 + error handlers must be last
app.use(notFoundHandler);
app.use(errorHandler);

// ──────────────────────────────────────────────────────────────────────────────
// Graceful shutdown
// ──────────────────────────────────────────────────────────────────────────────
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('HTTP server closed');

    try {
      await closeDatabasePool();
      // await redisClient.quit();
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (config.server.environment === 'production') {
    gracefulShutdown('unhandledRejection' as any);
  }
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Do not listen here in test environments (avoid port conflicts)
// const startServer = async () => { ... }
// startServer();

export { app, server };
