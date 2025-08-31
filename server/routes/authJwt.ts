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

/** small utils */
const isProd = process.env.NODE_ENV === "production";
const CSRF_COOKIE = "csrf_token";
const commonCookie = { httpOnly: true as const, sameSite: "lax" as const, secure: isProd, path: "/" };

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

/** CSRF (double-submit cookie) */
function ensureCsrfCookie(req: Request, res: Response, next: NextFunction) {
  const has = (req as any).cookies?.[CSRF_COOKIE];
  if (!has) {
    res.cookie(CSRF_COOKIE, randomString(32), { ...commonCookie, httpOnly: false, maxAge: 30 * 24 * 3600 * 1000 });
  }
  next();
}
function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (/^(GET|HEAD|OPTIONS)$/.test(req.method)) return next();
  const header = req.get("X-CSRF-Token");
  const cookie = (req as any).cookies?.[CSRF_COOKIE] ?? parseCookie(req.headers.cookie || "")[CSRF_COOKIE];

  // allow mint-from-session if a Replit session is already authenticated (same-site)
  const hasIsAuthFn = typeof (req as any).isAuthenticated === "function";
  const isAuthedSession = hasIsAuthFn && (req as any).isAuthenticated();

  if (!header || !cookie || header !== cookie) {
    if (req.path === "/mint-from-session" && isAuthedSession) return next();
    return res.status(403).json({ ok: false, error: "CSRF invalid/missing" });
  }
  next();
}

/** JWT cookie helpers */
function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("access_token", accessToken, { ...commonCookie, maxAge: 15 * 60 * 1000 }); // 15m
  res.cookie("refresh_token", refreshToken, { ...commonCookie, maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30d
}
function clearAuthCookies(res: Response) {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
}

/** helpers to read Replit/Passport user safely */
function extractReplitUser(req: any) {
  const u = req?.user;
  const claims = u?.claims ?? u?.profile ?? u ?? null;
  const id = claims?.sub || claims?.id || u?.id;
  const email = claims?.email || u?.email;
  const name = claims?.name || u?.name;
  return {
    id,
    email,
    name,
    ok: !!id,
    debug: {
      hasReqUser: !!u,
      reqUserKeys: u ? Object.keys(u) : [],
      hasClaims: !!claims,
      claimKeys: claims ? Object.keys(claims) : [],
    },
  };
}

/** router */
const router = Router();
router.use(cookieParser());
router.use(ensureCsrfCookie);

// prime CSRF (handy in the browser console)
router.get("/csrf", (req, res) => {
  const token = (req as any).cookies?.[CSRF_COOKIE] ?? parseCookie(req.headers.cookie || "")[CSRF_COOKIE] ?? "";
  res.json({ ok: true, csrf: token });
});

// debug endpoints to see what's on req (temporary but safe to keep)
router.get("/debug", (req: any, res) => {
  const hasIsAuthFn = typeof req.isAuthenticated === "function";
  res.json({
    ok: true,
    hasIsAuthFn,
    isAuthenticated: hasIsAuthFn ? !!req.isAuthenticated() : null,
    hasReqUser: !!req.user,
    reqUserKeys: req.user ? Object.keys(req.user) : [],
    sampleUser: req.user && typeof req.user === "object" ? { ...req.user, tokens: undefined } : null,
  });
});
router.get("/whoami", (req: any, res) => {
  res.json({ ok: true, user: req.user || null });
});

router.use(requireCsrf);

/** DEV login (email/password) — optional helper */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ ok: false, error: "invalid input" });

    const user: JwtUser = { id: email, email, name: email.split("@")[0] };
    const { accessToken, refreshToken, sid } = issueSession(user);
    setAuthCookies(res, accessToken, refreshToken);
    return res.json({ ok: true, user: { id: user.id, email: user.email }, sid });
  } catch (err) {
    console.error("[authJwt] /login error", err);
    return res.status(500).json({ ok: false, error: "internal" });
  }
});

/** Mint JWT cookies from Replit OIDC session */
router.post("/mint-from-session", async (req: any, res) => {
  const hasIsAuthFn = typeof req.isAuthenticated === "function";
  const isAuthed = hasIsAuthFn ? !!req.isAuthenticated() : false;
  const extracted = extractReplitUser(req);

  if (!isAuthed) {
    return res.status(401).json({
      ok: false,
      error: "not authenticated via Replit session",
      debug: { hasIsAuthFn, isAuthed, ...extracted.debug },
    });
  }
  if (!extracted.ok) {
    return res.status(400).json({
      ok: false,
      error: "could not determine user id from session",
      debug: extracted.debug,
    });
  }

  try {
    const user: JwtUser = { id: extracted.id!, email: extracted.email, name: extracted.name };
    const { accessToken, refreshToken, sid } = issueSession(user);
    setAuthCookies(res, accessToken, refreshToken);
    return res.json({ ok: true, user: { id: user.id, email: user.email }, sid });
  } catch (err: any) {
    console.error("[authJwt] /mint-from-session error", err);
    return res.status(500).json({ ok: false, error: "internal", detail: err?.message });
  }
});

/** Single refresh attempt; rotates refresh token */
router.post("/refresh", async (req: any, res) => {
  try {
    const rt = req.cookies?.refresh_token;
    if (!rt) return res.status(401).json({ ok: false, error: "missing refresh" });
    const payload = verifyRefresh(rt); // { uid, sid, jti, exp }
    const { accessToken, refreshToken } = rotateRefresh(payload.jti, payload.uid, payload.sid);
    setAuthCookies(res, accessToken, refreshToken);
    return res.json({ ok: true, sid: payload.sid });
  } catch (err) {
    console.error("[authJwt] /refresh error", err);
    return res.status(401).json({ ok: false, error: "refresh failed" });
  }
});

/** Logout (JWT cookies). Optionally revoke server-side refreshes for this session. */
router.post("/logout", async (req, res) => {
  try {
    const { uid, sid } = (req.body || {}) as { uid?: string; sid?: string };
    if (uid && sid) revokeAllForSid(uid, sid);
    clearAuthCookies(res);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[authJwt] /logout error", err);
    return res.status(500).json({ ok: false, error: "internal" });
  }
});
router.get("/logout", (_req, res) => {
  clearAuthCookies(res);
  return res.json({ ok: true });
});

/** Session probe via access_token cookie */
router.get("/session", (req: any, res) => {
  try {
    const at = req.cookies?.access_token;
    if (!at) return res.status(401).json({ error: "No active session" });
    const payload = verifyAccess(at);
    const user = { id: payload.id, email: payload.email, name: payload.name };
    return res.json({ ok: true, authenticated: true, user, sid: payload.sid });
  } catch {
    return res.status(401).json({ error: "No active session" });
  }
});

/** final JSON error handler */
router.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[authJwt] unhandled error", err);
  res.status(500).json({ ok: false, error: "internal" });
});

export default router;