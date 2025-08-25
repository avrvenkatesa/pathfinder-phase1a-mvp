import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { setupAuth } from './auth-setup';
import { setupRoutes } from './routes';
import { setupDocs } from './swagger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.AUTH_SERVICE_PORT || '3003');
const HOST = process.env.HOST || '0.0.0.0';

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
  });
});

// Setup authentication
setupAuth(app);

// Setup API routes
setupRoutes(app);

// Setup API documentation
setupDocs(app);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Auth Service Error:', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    success: false,
    error: 'AUTH_SERVICE_ERROR',
    message,
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: 'Endpoint not found',
  });
});

app.listen(PORT, HOST, () => {
  console.log(`🔐 Auth Service running on http://${HOST}:${PORT}`);
  console.log(`📖 API Documentation: http://${HOST}:${PORT}/api-docs`);
});