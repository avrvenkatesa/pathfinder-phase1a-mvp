import express from 'express';
import rateLimit from 'express-rate-limit';

export function setupRateLimiting(app: express.Express) {
  // General API rate limiting
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: {
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Strict rate limiting for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 auth requests per windowMs
    message: {
      success: false,
      error: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Write operations rate limiting
  const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 write requests per windowMs
    message: {
      success: false,
      error: 'WRITE_RATE_LIMIT_EXCEEDED',
      message: 'Too many write requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Bulk operations rate limiting
  const bulkLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 bulk requests per windowMs
    message: {
      success: false,
      error: 'BULK_RATE_LIMIT_EXCEEDED',
      message: 'Too many bulk requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiters
  app.use(generalLimiter);

  // Specific rate limiting for auth endpoints
  app.use('/api/auth', authLimiter);

  // Apply stricter limits to write operations
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (req.path.includes('/bulk')) {
        return bulkLimiter(req, res, next);
      } else {
        return writeLimiter(req, res, next);
      }
    }
    next();
  });

  console.log('✅ Rate limiting configured:');
  console.log('   General: 1000 requests per 15 minutes');
  console.log('   Auth: 20 requests per 15 minutes');
  console.log('   Write: 200 requests per 15 minutes');
  console.log('   Bulk: 20 requests per 15 minutes');
}