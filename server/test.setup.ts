// server/test.setup.ts
import { vi } from 'vitest';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';

// Load the server env so DATABASE_URL is available in tests
dotenv.config({ path: resolve(process.cwd(), 'server/.env') });

// Mock auth so routes mount without real OIDC/session
vi.mock('./replitAuth', () => ({
  setupAuth: async () => {},
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));
