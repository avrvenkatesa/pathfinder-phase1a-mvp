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
  const isAuthedSession = hasIsAuthFn && (req as any).isAuthe
