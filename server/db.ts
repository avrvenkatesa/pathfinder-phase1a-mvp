// server/db.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '@shared/schema';

// Use WebSocket transport for Neon
neonConfig.webSocketConstructor = ws;

// --- Optional safety: load env if not already present (dev/test only) ---
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';
import * as fs from 'node:fs';

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  const serverEnv = resolve(process.cwd(), 'server/.env');
  if (fs.existsSync(serverEnv)) {
    dotenv.config({ path: serverEnv });
  } else {
    // fallback to root .env if someone uses it
    dotenv.config();
  }
}

// Prefer TEST_DATABASE_URL in tests if provided, else fall back to DATABASE_URL
const CONNECTION_STRING =
  (process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL) ||
  process.env.DATABASE_URL;

if (!CONNECTION_STRING) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

// Create Neon pool and Drizzle client
export const pool = new Pool({ connectionString: CONNECTION_STRING });
// If you ever need to tune, you can pass { max: 5 } or similar.

export const db = drizzle({ client: pool, schema });
