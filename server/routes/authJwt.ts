import { Router } from "express";
import cookieParser from "cookie-parser";
import { randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";

const ISSUER = process.env.JWT_ISSUER || "pathfinder";
const AUDIENCE = process.env.REPL_DOMAIN || "replit-app";
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "30d";

const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";
const CSRF_COOKIE = "csrf_token";

function getKey(name: "ACCESS_TOKEN_SECRET" | "REFRESH_TOKEN_SECRET"): Uint8Array {
  const s = process.env[name];
  if (!s) throw new Error(`${name} is not set`);
  try {
    return Buffer.from(s, "base64url");        // recommended format
  } catch {
    return Buffer.from(s, "utf8");             // fallback if not base64url
  }
}
const accessKey = () => getKey("ACCESS_TOKEN_SECRET");
const refreshKey = () => getKey("REFRESH_TOKEN_SECRET");

function baseCookieOpts(httpOnly = true) {
  return { httpOnly, sameSite: "lax" as const, secure: true, path: "/" };
}

async function signAccessToken(sub: string, extra: Record<string, any> = {}) {
  return await new SignJWT({ sub, ...extra })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(sub)
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(accessKey());
}

async function signRefreshToken(sub: string) {
  return await new SignJWT({ sub })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(sub)
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(refreshKey());
}

async function verifyAccess(token: string) {
  const { payload } = await jwtVerify(token, accessKey(), { issuer: ISSUER, audience: AUDIENCE });
  return payload;
}

async function verifyRefresh(token: string) {
  const { payload } = await jwtVerify(token, refreshKey(), { issuer: ISSUER, audience: AUDIENCE });
  return payload;
}

// ---- Router ----
const router = Router();
router.use(cookieParser());

// 1) CSRF: set readable cookie + return token
router.get("/csrf", (_req, res) => {
  const csrf = randomBytes(32).toString("base64url");
  res.cookie(CSRF_COOKIE, csrf, { ...baseCookieOpts(false) }); // not httpOnly
  res.json({ csrf });
});

// 2) Mint cookies from Replit OIDC session (requires setupAuth(app) to set req.user)
router.post("/mint-from-session", async (req: any, res) => {
  try {
    const csrfHeader = req.get("x-csrf-token");
    const csrfCookie = req.cookies?.[CSRF_COOKIE];
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return res.status(403).json({ ok: false, error: "bad csrf" });
    }

    const user = req.user;
    const sub = user?.claims?.sub as string | undefined;
    if (!sub) {
      return res.status(401).json({ ok: false, error: "no replit session" });
    }

    const access = await signAccessToken(sub, {
      email: user.claims.email,
      name: user.claims.name,
    });
    const refresh = await signRefreshToken(sub);

    // 15m access, 30d refresh
    res.cookie(ACCESS_TOKEN_COOKIE, access, { ...baseCookieOpts(true), maxAge: 15 * 60 * 1000 });
    res.cookie(REFRESH_TOKEN_COOKIE, refresh, { ...baseCookieOpts(true), maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.json({ ok: true });
  } catch (err) {
    console.error("mint-from-session error:", err);
    res.status(500).json({ ok: false, error: "internal" });
  }
});

// GET version for OAuth callback redirect
router.get("/mint-from-session", async (req: any, res) => {
  try {
    const user = req.user;
    const sub = user?.claims?.sub as string | undefined;
    if (!sub) {
      console.error("No user session found in callback");
      return res.redirect("/api/login");
    }

    const access = await signAccessToken(sub, {
      email: user.claims.email,
      name: user.claims.name,
    });
    const refresh = await signRefreshToken(sub);

    // 15m access, 30d refresh
    res.cookie(ACCESS_TOKEN_COOKIE, access, { ...baseCookieOpts(true), maxAge: 15 * 60 * 1000 });
    res.cookie(REFRESH_TOKEN_COOKIE, refresh, { ...baseCookieOpts(true), maxAge: 30 * 24 * 60 * 60 * 1000 });

    console.log("JWT tokens minted successfully, redirecting to home");
    return res.redirect("/");
  } catch (err) {
    console.error("mint-from-session error:", err);
    return res.redirect("/api/login");
  }
});

// 3) Refresh access cookie from refresh cookie
router.post("/refresh", async (req, res) => {
  try {
    const refresh = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refresh) {
      return res.status(401).json({ ok: false, error: "missing refresh" });
    }
    const payload = await verifyRefresh(refresh);
    const sub = payload.sub as string;
    const access = await signAccessToken(sub);
    res.cookie(ACCESS_TOKEN_COOKIE, access, { ...baseCookieOpts(true), maxAge: 15 * 60 * 1000 });
    res.json({ ok: true });
  } catch (err) {
    console.warn("refresh error:", (err as any)?.message || err);
    res.status(401).json({ ok: false, error: "invalid refresh" });
  }
});

// 4) Return current session (via access cookie)
router.get("/session", async (req, res) => {
  try {
    const token = req.cookies?.[ACCESS_TOKEN_COOKIE];
    if (!token) return res.status(401).json({ error: "No active session" });
    const payload = await verifyAccess(token);
    res.json({ ok: true, authenticated: true, claims: payload });
  } catch {
    res.status(401).json({ ok: true, authenticated: false });
  }
});

// Add /user endpoint that the frontend expects
router.get("/user", async (req, res) => {
  try {
    const token = req.cookies?.[ACCESS_TOKEN_COOKIE];
    if (!token) return res.status(401).json({ error: "No active session" });
    const payload = await verifyAccess(token);
    res.json({ claims: payload });
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

// 5) Logout: clear cookies
router.post("/logout", (_req, res) => {
  res.cookie(ACCESS_TOKEN_COOKIE, "", { ...baseCookieOpts(true), maxAge: 0 });
  res.cookie(REFRESH_TOKEN_COOKIE, "", { ...baseCookieOpts(true), maxAge: 0 });
  res.status(200).json({ ok: true });
});

export const authJwtRoutes = router;
