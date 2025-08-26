import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import * as schema from '@shared/schema';
import ws from 'ws';

// Configure Neon serverless driver
neonConfig.webSocketConstructor = ws;

// Database connection configuration
export interface DatabaseConfig {
  connectionString: string;
  poolSize?: number;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  maxLifetimeSeconds?: number;
}

// Production database configuration with connection pooling
export const getDatabaseConfig = (): DatabaseConfig => {
  const config: DatabaseConfig = {
    connectionString: process.env.DATABASE_URL!,
    poolSize: parseInt(process.env.DB_POOL_SIZE || '20'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    maxLifetimeSeconds: parseInt(process.env.DB_MAX_LIFETIME || '1800'),
  };

  if (!config.connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  return config;
};

// Create optimized connection pool
export const createDatabasePool = (config: DatabaseConfig) => {
  const pool = new Pool({
    connectionString: config.connectionString,
    max: config.poolSize,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    idleTimeoutMillis: config.idleTimeoutMillis,
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected database pool error', err);
  });

  pool.on('connect', () => {
    console.log('New database connection established');
  });

  pool.on('remove', () => {
    console.log('Database connection removed from pool');
  });

  return pool;
};

// Create database instance with monitoring
export const createDatabase = () => {
  const config = getDatabaseConfig();
  const pool = createDatabasePool(config);
  
  // Create drizzle instance with monitoring
  const db = drizzle(pool, { 
    schema,
    logger: process.env.NODE_ENV === 'development',
  });

  // Add query performance monitoring
  const monitoredDb = new Proxy(db, {
    get(target, prop) {
      const original = target[prop as keyof typeof target];
      
      if (typeof original === 'function' && ['select', 'insert', 'update', 'delete'].includes(prop as string)) {
        return new Proxy(original, {
          apply(fn, thisArg, args) {
            const startTime = Date.now();
            const result = fn.apply(thisArg, args);
            
            // Log slow queries
            if (result && typeof result.then === 'function') {
              result.then(() => {
                const duration = Date.now() - startTime;
                if (duration > 1000) {
                  console.warn(`Slow query detected (${prop}): ${duration}ms`);
                }
              });
            }
            
            return result;
          }
        });
      }
      
      return original;
    }
  });

  return { db, pool };
};

// Export singleton instance
let dbInstance: ReturnType<typeof createDatabase> | null = null;

export const getDatabase = () => {
  if (!dbInstance) {
    dbInstance = createDatabase();
  }
  return dbInstance;
};

// Graceful shutdown
export const closeDatabasePool = async () => {
  if (dbInstance) {
    await dbInstance.pool.end();
    dbInstance = null;
    console.log('Database pool closed');
  }
};