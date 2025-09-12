// server/middleware/error-handler.ts
import type { Request, Response, NextFunction } from "express";
import { errorsTotal } from "../observability/metrics";

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case 400: return "VALIDATION_ERROR";
    case 401: return "UNAUTHORIZED";
    case 404: return "NOT_FOUND";
    case 409: return "CONFLICT";
    case 412: return "PRECONDITION_FAILED";
    case 428: return "PRECONDITION_REQUIRED";
    case 429: return "RATE_LIMITED";
    default:  return status >= 500 ? "INTERNAL" : "ERROR";
  }
}

export function notFoundHandler(req: Request, res: Response, _next: NextFunction) {
  const traceId = res.locals?.traceId;
  const code = "NOT_FOUND";
  const envelope = {
    error: {
      code,
      message: "Route not found.",
      details: { method: req.method, path: req.path },
      traceId,
    },
  };
  try { errorsTotal.inc({ code }); } catch {}
  res.status(404).json(envelope);
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;

  let status =
    (typeof err?.status === "number" && err.status) ||
    (typeof err?.statusCode === "number" && err.statusCode) ||
    (res.statusCode >= 400 ? res.statusCode : 500);

  const isZod = err?.name === "ZodError" || Array.isArray(err?.issues);
  if (isZod && status < 400) status = 400;

  const code: string =
    (err?.error?.code as string) ||
    (typeof err?.code === "string" && err.code) ||
    defaultCodeForStatus(status);

  const message: string =
    (err?.error?.message as string) ||
    (typeof err?.message === "string" && err.message) ||
    defaultCodeForStatus(status).replaceAll("_", " ").toLowerCase();

  const details =
    (err?.error?.details && typeof err.error.details === "object" ? err.error.details : undefined) ??
    (isZod ? { issues: err.issues } : undefined) ??
    undefined;

  const traceId = res.locals?.traceId;

  const envelope = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      traceId,
    },
  };

  try { errorsTotal.inc({ code }); } catch {}
  res.status(status).json(envelope);
}
