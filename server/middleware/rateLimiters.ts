import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

/**
 * Centralized rate-limiter presets for runtime routes.
 * Defaults are tuned for tests and can be overridden via env.
 */
const windowMs = Number(process.env.RATE_WINDOW_MS ?? 60_000); // 60s
const listLimit = Number(process.env.RATE_LIST_LIMIT ?? 60);
const detailLimit = Number(process.env.RATE_DETAIL_LIMIT ?? 120);
const stepWriteLimit = Number(process.env.RATE_STEP_WRITE_LIMIT ?? 60);
const convenienceLimit = Number(process.env.RATE_CONVENIENCE_LIMIT ?? 30);
const generalLimit = Number(process.env.RATE_GENERAL_LIMIT ?? 300);

/** Common options */
const baseOptions = {
  windowMs,
  standardHeaders: true as const,
  legacyHeaders: false,
  // Allow disabling via env for local debugging (keep enabled in CI)
  skip: () => process.env.RATE_LIMITS_OFF === "1",
  // Make tests deterministic per X-Test-Auth header
  keyGenerator: (req: Request) => `${req.ip}|${req.header("X-Test-Auth") ?? ""}`,
  handler: (_req: Request, res: Response, _next: NextFunction) => {
    const retryAfterSec = Math.ceil(windowMs / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please retry later.",
      },
    });
  },
};

export const rateLimiters = {
  general: rateLimit({ ...baseOptions, limit: generalLimit }),
  instancesRead: rateLimit({ ...baseOptions, limit: listLimit }),
  instancesDetail: rateLimit({ ...baseOptions, limit: detailLimit }),
  stepWrite: rateLimit({ ...baseOptions, limit: stepWriteLimit }),
  convenienceWrite: rateLimit({ ...baseOptions, limit: convenienceLimit }),
};

export default rateLimiters;
