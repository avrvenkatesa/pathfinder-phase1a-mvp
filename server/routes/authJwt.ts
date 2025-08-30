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

// ---------- util ----------
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
const isProd = process.env.NODE_ENV === "production";
const commonCookie = { httpOnly: true as const, sameSite: "lax" as const, secure: isProd, path: "/" };

// ---------- CSRF (double-submit cookie) ----------
const CSRF_COOKIE = "csrf_token";
function ensureCsrfCookie(_req: Request, res: Response, next: NextFunction) {
  const has = !!res.req?.headers?.cookie && parseCookie(res.req.headers.cookie)[CSRF_COOKIE];
  if (!has) {
    const val = randomString(32);
    res.cookie(CSRF_COOKIE, val, { ...commonCookie, httpOnly: false, maxAge: 30 * 24 * 3600 * 1000 });
  }
  next();
}
function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (/^(GET|HEAD|OPTIONS)$/.test(req.method)) return next();
  const header = req.get("X-CSRF-Token");
  const cookie = parseCookie(req.headers.cookie || "")[CSRF_COOKIE];
  // Allow POST /mint-from-session if the Replit session is already authenticated (same-site).
  const hasIsAuthFn = typeof (req as any).isAuthenticated === "function";
  const isAuthedSession = hasIsAuthFn && (req as any).isAuthenticated();
  if (!header || !cookie || header !== cookie) {
    if (req.path === "/mint-from-session" && isAuthedSession) return next();
    return res.status(403).json({ ok: false, error: "CSRF invalid/missing" });
  }
  next();
}

// ---------- cookie helpers ----------
function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("access_token", accessToken, { ...commonCookie, maxAge: 15 * 60 * 1000 }); // 15m
  res.cookie("refresh_token", refreshToken, { ...commonCookie, maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30d
}
function clearAuthCookies(res: Response) {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
}
