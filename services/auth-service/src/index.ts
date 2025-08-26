import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { setupAuth } from './auth-setup';
import { setupRoutes } from './routes';
import { storage } from './storage';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.AUTH_SERVICE_PORT || '3003');
const HOST = process.env.HOST || '0.0.0.0';

// Enhanced security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'unsafe-dynamic'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
    },
    reportOnly: false,
  },
}));
app.use(compression());

// Enhanced CORS configuration
const corsOrigins = process.env.NODE_ENV === 'production' ? 
  process.env.CORS_ORIGINS?.split(',') || [] : 
  ['http://localhost:3000', 'http://localhost:5000'];
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check with enhanced info
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    features: {
      mfa: true,
      oauth: !!process.env.GOOGLE_CLIENT_ID || !!process.env.MICROSOFT_CLIENT_ID,
      rbac: true,
      auditLogs: true,
      accountLockout: true,
    },
  });
});

// Setup authentication with error handling
setupAuth(app).catch(err => {
  console.error('Failed to setup authentication:', err);
  process.exit(1);
});

// Setup API routes
setupRoutes(app);

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

// Cleanup expired sessions periodically (every hour)
setInterval(async () => {
  try {
    const cleaned = await storage.deleteExpiredSessions();
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired sessions`);
    }
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
}, 60 * 60 * 1000);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 Auth Service shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Auth Service shutting down gracefully...');
  process.exit(0);
});

app.listen(PORT, HOST, () => {
  console.log(`🔐 Auth Service running on http://${HOST}:${PORT}`);
  console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🛡️  Enhanced Security Features Enabled:');
    console.log('   ✓ Rate limiting and DDoS protection');
    console.log('   ✓ Account lockout after failed attempts'); 
    console.log('   ✓ Multi-Factor Authentication (TOTP + backup codes)');
    console.log('   ✓ OAuth2 providers (Google, Microsoft Azure AD)');
    console.log('   ✓ JWT token-based API authentication');
    console.log('   ✓ Comprehensive audit logging');
    console.log('   ✓ Role-Based Access Control (RBAC)');
    console.log('   ✓ Password complexity enforcement');
    console.log('   ✓ Secure session management with refresh tokens');
    console.log('   ✓ Email verification and password reset');
    console.log('   ✓ Automated expired session cleanup');
  }
});