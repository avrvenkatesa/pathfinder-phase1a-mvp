// server/config/jwt.ts
import * as jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

/**
 * Types
 */
export type JwtUser = { id: string; email?: string; name?: string };
export type AccessPayload = JwtUser & { sid: string }; // session/version id
export type RefreshPayload = { uid: string; sid: string; jti: string };

/**
 * Config (env-driven with sensible defaults)
 */
export const ACCESS_TTL_SEC =
  parseInt(process.env.ACCESS_TTL_SEC || "", 10) || 15 * 60; // 15m
export const REFRESH_TTL_SEC =
  parseInt(process.env.REFRESH_TTL_SEC || "", 10) || 30 * 24 * 60 * 60; // 30d

const ACCESS_SECRET =
  process.env.ACCESS_TOKEN_SECRET || "change-me-access-secret-32+";
const REFRESH_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "change-me-refresh-secret-32+";

/**
 * In-memory allowlist of refresh tokens (by jti).
 * Replace with a DB table for production robustness.
 */
type RefreshRow = { uid: string; sid: string; expMs: number };
const refreshStore = new Map<string, RefreshRow>(); // jti -> row

/**
 * Issue a new session (access + refresh) for a user.
 * Returns tokens and the generated sid (session id).
 */
export function issueSession(user: JwtUser) {
  const sid = randomUUID();
  const accessToken = signAccess({ ...user, sid });
  const { refreshToken, jti, exp } = signRefresh({ uid: user.id, sid });
  refreshStore.set(jti, { uid: user.id, sid, expMs: exp * 1000 });
  return { accessToken, refreshToken, sid };
}

/**
 * Rotate a refresh token: invalidates old jti and returns new tokens.
 */
export function rotateRefresh(oldJti: string, uid: string, sid: string) {
  refreshStore.delete(oldJti);
  const accessToken = signAccess({ id: uid, sid });
  const { refreshToken, jti, exp } = signRefresh({ uid, sid });
  refreshStore.set(jti, { uid, sid, expMs: exp * 1000 });
  return { accessToken, refreshToken, jti, exp };
}

/**
 * Revoke all refresh tokens for a given user+sid (log out session everywhere).
 */
export function revokeAllForSid(uid: string, sid: string) {
  for (const [k, v] of refreshStore.entries()) {
    if (v.uid === uid && v.sid === sid) refreshStore.delete(k);
  }
}

/**
 * Verify access token -> AccessPayload (throws on invalid/expired).
 */
export function verifyAccess(token: string): AccessPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessPayload;
}

/**
 * Verify refresh token and check allowlist (throws if invalidated/expired).
 */
export function verifyRefresh(token: string): RefreshPayload & { exp: number } {
  const payload = jwt.verify(token, REFRESH_SECRET) as RefreshPayload & {
    exp: number;
  };
  const row = refreshStore.get(payload.jti);
  if (!row || row.uid !== payload.uid || row.sid !== payload.sid) {
    const err = new Error("refresh token invalidated");
    // @ts-expect-error add code for upstream handlers if desired
    err.code = "REFRESH_INVALID";
    throw err;
  }
  return payload;
}

/**
 * Helpers (sign)
 */
function signAccess(payload: AccessPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL_SEC });
}
function signRefresh(payload: RefreshPayload): {
  refreshToken: string;
  jti: string;
  exp: number;
} {
  const jti = randomUUID();
  const refreshToken = jwt.sign({ ...payload, jti }, REFRESH_SECRET, {
    expiresIn: REFRESH_TTL_SEC,
  });
  const decoded = jwt.decode(refreshToken) as jwt.JwtPayload;
  return { refreshToken, jti, exp: (decoded.exp as number) ?? 0 };
}
