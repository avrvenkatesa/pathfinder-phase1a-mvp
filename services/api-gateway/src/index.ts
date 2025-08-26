import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { setupProxies } from './proxies';
import { setupDocs } from './swagger';
import { setupRateLimiting } from './middleware/rate-limiting';
import { setupHealthChecks } from './health-checks';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.API_GATEWAY_PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration - more permissive since this is the main entry point
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5000'];
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-user-id'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} in ${duration}ms`);
  });
  next();
});

// Setup rate limiting
setupRateLimiting(app);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
  });
});

// Setup health checks aggregation
setupHealthChecks(app);

// Setup API documentation
setupDocs(app);

// Setup service proxies
setupProxies(app);

// Global error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Gateway Error:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    success: false,
    error: 'API_GATEWAY_ERROR',
    message,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, HOST, () => {
  console.log(`🌐 API Gateway running on http://${HOST}:${PORT}`);
  console.log(`📖 API Documentation: http://${HOST}:${PORT}/api-docs`);
  console.log(`🔍 Health Check: http://${HOST}:${PORT}/health`);
  console.log('🔗 Service Endpoints:');
  console.log(`  - Auth Service: http://localhost:${process.env.AUTH_SERVICE_PORT || 3003}`);
  console.log(`  - Contact Service: http://localhost:${process.env.CONTACT_SERVICE_PORT || 3001}`);
  console.log(`  - Workflow Service: http://localhost:${process.env.WORKFLOW_SERVICE_PORT || 3002}`);
});