import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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

// Import controllers
import * as contactsController from './controllers/contacts.js';
import * as bulkController from './controllers/bulk.js';
import * as analyticsController from './controllers/analytics.js';
import * as workflowController from './controllers/workflow.js';

// Validate configuration on startup
validateConfig();

// Create Express app
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
app.use(cors(config.security.cors));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
  secret: config.security.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: config.security.session,
  // In production, add session store (Redis/PostgreSQL)
}));

// API Routes with rate limiting and caching

// Health and monitoring endpoints
app.get('/health', asyncHandler(async (req: any, res: any) => {
  const health = await healthMonitor.checkHealth();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
}));

app.get('/metrics', rateLimiters.read, metricsEndpoint);

// Cache administration (for development/staging)
if (config.server.environment !== 'production') {
  app.get('/cache/status', cacheAdmin.status);
  app.delete('/cache', cacheAdmin.clear);
  app.delete('/cache/tags/:tag', cacheAdmin.invalidateTag);
}

// API v1 routes
const apiRouter = express.Router();

// Contact management endpoints
apiRouter.get('/contacts', 
  rateLimiters.read,
  cacheConfigs.contactsList,
  // contactsController.listContacts
);

apiRouter.get('/contacts/stats', 
  rateLimiters.read,
  cacheConfigs.contactStats,
  // contactsController.getContactStats
);

apiRouter.get('/contacts/:id', 
  rateLimiters.read,
  cacheConfigs.contactDetail,
  // contactsController.getContact
);

apiRouter.post('/contacts', 
  rateLimiters.write,
  invalidateCache(['contacts']),
  validate(contactSchemas.create),
  // contactsController.createContact
);

apiRouter.put('/contacts/:id', 
  rateLimiters.write,
  invalidateCache(['contacts']),
  validate(contactSchemas.update),
  // contactsController.updateContact
);

apiRouter.delete('/contacts/:id', 
  rateLimiters.write,
  invalidateCache(['contacts']),
  // contactsController.deleteContact
);

// Search endpoints
apiRouter.post('/contacts/search', 
  rateLimiters.read,
  cacheConfigs.searchResults,
  validate(contactSchemas.search),
  // contactsController.searchContacts
);

// Bulk operations
apiRouter.post('/contacts/bulk', 
  rateLimiters.bulk,
  invalidateCache(['contacts']),
  bulkController.bulkCreateContacts
);

apiRouter.put('/contacts/bulk', 
  rateLimiters.bulk,
  invalidateCache(['contacts']),
  bulkController.bulkUpdateContacts
);

apiRouter.delete('/contacts/bulk', 
  rateLimiters.bulk,
  invalidateCache(['contacts']),
  bulkController.bulkDeleteContacts
);

// File upload for bulk import
apiRouter.post('/contacts/import/csv', 
  rateLimiters.bulk,
  invalidateCache(['contacts']),
  // Add multer middleware for file upload
  bulkController.bulkImportCSV
);

// Relationship management
apiRouter.post('/relationships/bulk', 
  rateLimiters.bulk,
  invalidateCache(['contacts', 'relationships']),
  bulkController.bulkAssignRelationships
);

// Analytics endpoints
apiRouter.get('/analytics/contacts', 
  rateLimiters.read,
  cacheConfigs.analytics,
  analyticsController.getContactAnalytics
);

apiRouter.get('/analytics/activity', 
  rateLimiters.read,
  analyticsController.getActivityAnalytics
);

apiRouter.get('/analytics/performance', 
  rateLimiters.read,
  analyticsController.getPerformanceAnalytics
);

apiRouter.get('/analytics/engagement', 
  rateLimiters.read,
  analyticsController.getEngagementMetrics
);

apiRouter.get('/analytics/capacity', 
  rateLimiters.read,
  analyticsController.getCapacityMetrics
);

apiRouter.post('/analytics/reports/custom', 
  rateLimiters.write,
  analyticsController.generateCustomReport
);

// Workflow integration endpoints (Phase 1B preparation)
apiRouter.post('/workflow/contacts/match', 
  rateLimiters.read,
  workflowController.findMatchingContacts
);

apiRouter.post('/workflow/capacity/analyze', 
  rateLimiters.read,
  workflowController.analyzeTeamCapacity
);

apiRouter.post('/workflow/assignments/simulate', 
  rateLimiters.write,
  workflowController.simulateWorkflowAssignment
);

apiRouter.get('/workflow/assignments/history', 
  rateLimiters.read,
  workflowController.getWorkflowAssignmentHistory
);

// Mount API router
app.use('/api/v1', apiRouter);

// API documentation (in development)
if (config.server.environment !== 'production') {
  app.get('/api-docs', (req, res) => {
    res.redirect('/api/docs');
  });
  
  // Serve OpenAPI spec
  app.get('/api/docs/openapi.yaml', (req, res) => {
    res.sendFile('docs/openapi.yaml', { root: './server' });
  });
}

// Global rate limiter for all other routes
app.use(rateLimiters.general);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  // Close server
  server.close(async () => {
    console.log('HTTP server closed');
    
    try {
      // Close database connections
      await closeDatabasePool();
      
      // Close Redis connections if configured
      // await redisClient.quit();
      
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force close after 30 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // In production, consider shutting down gracefully
  if (config.server.environment === 'production') {
    gracefulShutdown('unhandledRejection');
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Exit immediately for uncaught exceptions
  process.exit(1);
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const { db } = getDatabase();
    console.log('Database connection established');

    // Register health checks
    healthMonitor.registerHealthCheck('database', async () => {
      try {
        await db.execute('SELECT 1');
        return true;
      } catch {
        return false;
      }
    });

    // Start HTTP server
    server.listen(config.server.port, config.server.host, () => {
      console.log(`
🚀 Contact Management API Server Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Environment: ${config.server.environment}
Server:      http://${config.server.host}:${config.server.port}
Health:      http://${config.server.host}:${config.server.port}/health
Metrics:     http://${config.server.host}:${config.server.port}/metrics
API Docs:    http://${config.server.host}:${config.server.port}/api-docs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);

      // Log configuration summary
      console.log('Configuration Summary:');
      console.log(`- Database Pool Size: ${config.database.pool.size}`);
      console.log(`- Rate Limiting: ${config.rateLimiting.general.max} req/min`);
      console.log(`- Caching: ${config.performance.cache.enabled ? 'Enabled' : 'Disabled'}`);
      console.log(`- Compression: ${config.performance.compression.enabled ? 'Enabled' : 'Disabled'}`);
      console.log(`- Monitoring: ${config.monitoring.enabled ? 'Enabled' : 'Disabled'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
// startServer(); // Commented out to prevent port conflict

export { app, server };