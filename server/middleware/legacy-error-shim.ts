// server/middleware/legacy-error-shim.ts
import type { NextFunction, Request, Response } from "express";

/**
 * Wraps any legacy res.status(4xx/5xx).json({...}) into:
 * { error: { code, message, details?, traceId? } }
 * If the body is already in the new shape, it is left as-is.
 */
export function legacyErrorShim(req: Request, res: Response, next: NextFunction) {
  const origJson = res.json.bind(res);

  res.json = (body: any) => {
    const isErrorStatus = res.statusCode >= 400;
    const looksCanonical =
      body &&
      typeof body === "object" &&
      body.error &&
      typeof body.error === "object" &&
      typeof body.error.code === "string" &&
      typeof body.error.message === "string";

    if (isErrorStatus && body && typeof body === "object" && !looksCanonical) {
      const traceId =
        (req.headers["x-request-id"] as string) ||
        (res.locals?.requestId as string) ||
        undefined;

      // derive code from explicit code/message or from status
      const derivedCodeFromStatus = (() => {
        const s = res.statusCode;
        if (s === 401) return "AUTH_MISSING";
        if (s === 403) return "FORBIDDEN";
        if (s === 404) return "NOT_FOUND";
        if (s === 405) return "METHOD_NOT_ALLOWED";
        if (s === 409) return "CONFLICT";
        if (s === 412) return "PRECONDITION_FAILED";
        if (s === 428) return "PRECONDITION_REQUIRED";
        if (s === 422) return "VALIDATION_FAILED";
        if (s === 429) return "RATE_LIMITED";
        if (s >= 500) return "INTERNAL_ERROR";
        return "VALIDATION_FAILED";
      })();

      const code =
        (typeof body.code === "string" && body.code) ||
        (typeof body.error === "string" && body.error.toUpperCase().replace(/\s+/g, "_")) ||
        derivedCodeFromStatus;

      const message =
        (typeof body.message === "string" && body.message) ||
        (typeof body.error === "string" && body.error) ||
        "Request failed";

      // Try to preserve any useful context
      const detailsCandidate: Record<string, unknown> = {};
      if (body.details !== undefined) detailsCandidate.details = body.details;
      if (body.errors !== undefined) detailsCandidate.errors = body.errors;
      if (body.blockingDeps !== undefined) detailsCandidate.blockingDeps = body.blockingDeps;
      if (body.detail !== undefined) detailsCandidate.detail = body.detail;
      const details =
        Object.keys(detailsCandidate).length > 0 ? detailsCandidate : undefined;

      const wrapped: any = { error: { code: String(code), message: String(message), traceId } };
      if (details) wrapped.error.details = details;

      return origJson(wrapped);
    }

    return origJson(body);
  };

  next();
}
