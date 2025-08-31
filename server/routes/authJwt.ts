// server/routes/authJwt.ts
import { Router, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import {
  issueSession,
  verifyAccess,
  verifyRefresh,
  rotateRefresh,
  revokeAllForSid,
  type JwtUser,
} from "../config/jwt";

/**
 * Small helpers
 */
const isProd = process.env.NODE_ENV === "production";
const CSRF_COOKIE = "csrf_token";
const commonCookie = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: isProd,
  path: "/",
};

function parseCookie(s: string) {
  const out: Record<string, string> = {};
  (s || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1));
  });
  return out;
}

function randomString(n = 32) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * CSRF (double-submit cookie)
 */
function ensureCsrfCookie(req: Request, res: Response, next: NextFunction) {
  // cookie-parser populates req.cookies
  const has = (req as any).cookies?.[CSRF_COOKIE];
  if (!has) {
    const val = randomString(32);
    // httpOnly: false so client JS can read and send it in X-CSRF-Token
    res.cookie(CSRF_COOKIE, val, { ...commonCookie, httpOnly: false, maxAge: 30 * 24 * 3600 * 1000 });
  }
  next();
}

function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (/^(GET|HEAD|OPTIONS)$/.test(req.method)) return next();
  const header = req.get("X-CSRF-Token");
  const cookie = (req as any).cookies?.[CSRF_COOKIE] ?? parseCookie(req.headers.cookie || "")[CSRF_COOKIE];

  // Allow POST /mint-from-session to proceed if user is already authenticated via Replit session
  const hasIsAuthFn = typeof (req as any).isAuthenticated === "function";
  const isAuthedSession = hasIsAuthFn && (req as any).isAuthenticated();
  
  if (req.path === "/mint-from-session" && isAuthedSession) {
    return next();
  }

  if (!header || !cookie || header !== cookie) {
    return res.status(403).json({ error: "CSRF token mismatch" });
  }
  next();
}

/**
 * Auth middleware
 */
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const user = verifyAccess(token);
    (req as any).user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * Routes
 */
const router = Router();

// Apply cookie parser and CSRF middleware
router.use(cookieParser());
router.use(ensureCsrfCookie);
router.use(requireCsrf);

// Login endpoint
router.post("/login", async (req: Request, res: Response) => {
  try {
    // This would typically validate credentials against a database
    // For now, using a simple hardcoded check
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // In a real app, you'd verify against your user database
    // For demo purposes, using simple validation
    if (username === "admin" && password === "password") {
      const user: JwtUser = { id: "1", email: username + "@example.com", name: username };
      const { accessToken, refreshToken, sid } = issueSession(user);
      
      // Set refresh token as httpOnly cookie
      res.cookie("refresh_token", refreshToken, {
        ...commonCookie,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({ accessToken, user, sessionId: sid });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

// Refresh token endpoint
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const refreshToken = (req as any).cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token" });
    }

    const refreshPayload = verifyRefresh(refreshToken);
    const { accessToken, refreshToken: newRefreshToken } = rotateRefresh(refreshPayload.jti, refreshPayload.uid, refreshPayload.sid);
    
    // Update refresh token cookie
    res.cookie("refresh_token", newRefreshToken, {
      ...commonCookie,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ accessToken });
  } catch (err) {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

// Logout endpoint
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const refreshToken = (req as any).cookies?.refresh_token;
    if (refreshToken) {
      const payload = verifyRefresh(refreshToken);
      revokeAllForSid(payload.uid, payload.sid);
    }
    
    // Clear refresh token cookie
    res.clearCookie("refresh_token", commonCookie);
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: "Logout failed" });
  }
});

// Protected route example
router.get("/profile", requireAuth, (req: Request, res: Response) => {
  res.json({ user: (req as any).user });
});

export default router;
