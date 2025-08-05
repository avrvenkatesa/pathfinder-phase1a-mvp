import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

// Environment variable validation schema
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().min(1).max(65535)).default(5000),
  HOST: z.string().default('0.0.0.0'),
  
  // Database Configuration
  DATABASE_URL: z.string().url(),
  DB_POOL_SIZE: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default(20),
  DB_CONNECTION_TIMEOUT: z.string().transform(Number).pipe(z.number().int().min(1000)).default(5000),
  DB_IDLE_TIMEOUT: z.string().transform(Number).pipe(z.number().int().min(10000)).default(30000),
  DB_MAX_LIFETIME: z.string().transform(Number).pipe(z.number().int().min(300)).default(1800),

  // Redis Configuration (for production caching)
  REDIS_URL: z.string().url().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TTL_DEFAULT: z.string().transform(Number).pipe(z.number().int().min(60)).default(300),

  // Security Configuration
  SESSION_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  ENCRYPTION_KEY: z.string().min(32),
  
  // API Security
  API_RATE_LIMIT_GENERAL: z.string().transform(Number).pipe(z.number().int().min(10)).default(100),
  API_RATE_LIMIT_AUTH: z.string().transform(Number).pipe(z.number().int().min(1)).default(5),
  API_RATE_LIMIT_BULK: z.string().transform(Number).pipe(z.number().int().min(1)).default(10),
  API_RATE_LIMIT_READ: z.string().transform(Number).pipe(z.number().int().min(50)).default(200),
  
  // CORS Configuration
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  
  // Monitoring and Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_REQUEST_LOGGING: z.string().transform(val => val === 'true').default(true),
  ENABLE_PERFORMANCE_MONITORING: z.string().transform(val => val === 'true').default(true),
  
  // External Services
  SENTRY_DSN: z.string().url().optional(),
  DATADOG_API_KEY: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  
  // File Upload
  MAX_FILE_SIZE: z.string().transform(Number).pipe(z.number().int().min(1024)).default(10485760), // 10MB
  UPLOAD_DIR: z.string().default('./uploads'),
  
  // Health Check
  HEALTH_CHECK_TIMEOUT: z.string().transform(Number).pipe(z.number().int().min(1000)).default(5000),
  
  // Application Specific
  CONTACT_SEARCH_LIMIT: z.string().transform(Number).pipe(z.number().int().min(10).max(1000)).default(100),
  BULK_OPERATION_LIMIT: z.string().transform(Number).pipe(z.number().int().min(10).max(10000)).default(1000),
});

// Validate and parse environment variables
const env = envSchema.parse(process.env);

// Production configuration object
export const productionConfig = {
  // Server settings
  server: {
    port: env.PORT,
    host: env.HOST,
    environment: env.NODE_ENV,
    trustProxy: env.NODE_ENV === 'production',
  },

  // Database configuration
  database: {
    url: env.DATABASE_URL,
    pool: {
      size: env.DB_POOL_SIZE,
      connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT,
      idleTimeoutMillis: env.DB_IDLE_TIMEOUT,
      maxLifetimeSeconds: env.DB_MAX_LIFETIME,
    },
    ssl: env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false,
    } : false,
  },

  // Redis configuration
  redis: {
    url: env.REDIS_URL,
    password: env.REDIS_PASSWORD,
    ttl: {
      default: env.REDIS_TTL_DEFAULT,
      contacts: 300, // 5 minutes
      analytics: 1800, // 30 minutes
      search: 120, // 2 minutes
    },
    retry: {
      attempts: 3,
      delay: 1000,
    },
  },

  // Security settings
  security: {
    session: {
      secret: env.SESSION_SECRET,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict' as const,
    },
    jwt: {
      secret: env.JWT_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
      algorithm: 'HS256' as const,
    },
    encryption: {
      key: env.ENCRYPTION_KEY,
      algorithm: 'aes-256-gcm',
    },
    cors: {
      origins: env.ALLOWED_ORIGINS.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    },
    headers: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
    },
  },

  // Rate limiting
  rateLimiting: {
    general: {
      windowMs: 60 * 1000, // 1 minute
      max: env.API_RATE_LIMIT_GENERAL,
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: env.API_RATE_LIMIT_AUTH,
    },
    bulk: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: env.API_RATE_LIMIT_BULK,
    },
    read: {
      windowMs: 60 * 1000, // 1 minute
      max: env.API_RATE_LIMIT_READ,
    },
  },

  // Logging configuration
  logging: {
    level: env.LOG_LEVEL,
    enableRequestLogging: env.ENABLE_REQUEST_LOGGING,
    format: env.NODE_ENV === 'production' ? 'json' : 'combined',
    outputs: env.NODE_ENV === 'production' 
      ? ['console', 'file'] 
      : ['console'],
  },

  // Monitoring
  monitoring: {
    enabled: env.ENABLE_PERFORMANCE_MONITORING,
    sentry: {
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    },
    datadog: {
      apiKey: env.DATADOG_API_KEY,
      service: 'contact-management-api',
      version: '1.0.0',
    },
    healthCheck: {
      timeout: env.HEALTH_CHECK_TIMEOUT,
      endpoints: [
        { name: 'database', url: 'postgresql://check' },
        { name: 'redis', url: env.REDIS_URL },
      ],
    },
  },

  // Application limits
  limits: {
    fileUpload: {
      maxSize: env.MAX_FILE_SIZE,
      allowedTypes: [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/json',
      ],
    },
    api: {
      contactSearchLimit: env.CONTACT_SEARCH_LIMIT,
      bulkOperationLimit: env.BULK_OPERATION_LIMIT,
      paginationMaxLimit: 1000,
    },
  },

  // External integrations
  integrations: {
    slack: {
      webhookUrl: env.SLACK_WEBHOOK_URL,
      channels: {
        alerts: '#api-alerts',
        errors: '#api-errors',
        monitoring: '#api-monitoring',
      },
    },
  },

  // Performance settings
  performance: {
    compression: {
      enabled: true,
      threshold: 1024, // Compress responses > 1KB
      level: 6, // Compression level 1-9
    },
    cache: {
      enabled: true,
      headers: {
        maxAge: 300, // 5 minutes
        mustRevalidate: true,
      },
    },
  },
};

// Environment-specific overrides
export const getConfig = () => {
  const config = { ...productionConfig };

  switch (env.NODE_ENV) {
    case 'development':
      config.logging.level = 'debug';
      config.security.session.secure = false;
      config.monitoring.sentry.tracesSampleRate = 1.0;
      break;

    case 'staging':
      config.logging.level = 'info';
      config.rateLimiting.general.max = config.rateLimiting.general.max * 2;
      break;

    case 'production':
      config.logging.level = 'warn';
      config.performance.compression.enabled = true;
      config.monitoring.enabled = true;
      break;
  }

  return config;
};

// Configuration validation
export const validateConfig = () => {
  const errors: string[] = [];

  // Required production settings
  if (env.NODE_ENV === 'production') {
    if (!env.REDIS_URL) {
      errors.push('REDIS_URL is required in production');
    }
    if (!env.SENTRY_DSN) {
      console.warn('Warning: SENTRY_DSN not configured for production');
    }
    if (env.SESSION_SECRET.length < 32) {
      errors.push('SESSION_SECRET must be at least 32 characters in production');
    }
    if (env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production');
    }
  }

  // Database URL validation
  try {
    new URL(env.DATABASE_URL);
  } catch {
    errors.push('DATABASE_URL must be a valid URL');
  }

  // Security validations
  if (env.NODE_ENV === 'production' && env.ALLOWED_ORIGINS.includes('*')) {
    errors.push('Wildcard CORS origins not allowed in production');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  console.log(`Configuration validated for environment: ${env.NODE_ENV}`);
};

// Export current configuration
export default getConfig();