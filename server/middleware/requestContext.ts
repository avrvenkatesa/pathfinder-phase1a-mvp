// server/middleware/requestContext.ts
import { type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "crypto";

declare global {
  // augment Express types for convenience
  namespace Express {
    interface Locals {
      traceId?: string;
      userId?: string | null;
    }
  }
}

/**
 * Ensures every request has a traceId and exposes it on the response header.
 * If you already set a requestId earlier, this will honor it.
 */
export function requestContext() {
  return (req: Request, res: Response, next: NextFunction) => {
    const fromHeader =
      (req.headers["x-request-id"] as string | undefined) ??
      (req.headers["x-correlation-id"] as string | undefined);

    const traceId = fromHeader ?? randomUUID();
    res.locals.traceId = traceId;

    // if your auth middleware populates res.locals.user, you can set userId here
    // res.locals.userId = res.locals.user?.id ?? null;

    res.setHeader("x-trace-id", traceId);
    next();
  };
}
