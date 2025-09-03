// server/replitAuth.ts
import type { Express, Request, Response, NextFunction } from 'express';

const DEV_MODE = !process.env.REPLIT_DOMAINS;

/**
 * Setup auth-related middleware.
 * In dev (no REPLIT_DOMAINS), we attach a stub user so routes depending on req.user work.
 * In prod, plug in your real session/JWT setup here.
 */
export async function setupAuth(app: Express) {
  if (DEV_MODE) {
    // Dev stub: every request looks authenticated with a fake user
    app.use((req: any, _res, next) => {
      req.user = {
        claims: {
          sub: 'dev-user',
          email: 'dev@example.com',
          name: 'Dev User',
          roles: ['developer'],
        },
      };
      next();
    });
    return;
  }

  // --- Production path (REPLIT_DOMAINS is set) ---
  // TODO: keep or wire your real Replit / session / JWT middleware here.
  // If you already had code here previously, paste it back inside this block.
  // Make sure nothing throws during import-time; do all checks inside this function.
}

/**
 * Gate routes that require auth.
 * In dev, it’s a no-op; in prod it enforces presence of req.user.claims
 */
export function isAuthenticated(req: Request & { user?: any }, res: Response, next: NextFunction) {
  if (DEV_MODE) return next();
  if (req.user?.claims) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

export default { setupAuth, isAuthenticated };
