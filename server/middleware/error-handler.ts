import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, type AppErrorJSON } from '../errors/types';
import { errors } from '../errors';

function zodDetails(e: ZodError) {
  // compact details for clients; still useful for UI
  return { issues: e.issues.map(i => ({ path: i.path, code: i.code, message: i.message })) };
}

export function notFoundHandler(req: Request, res: Response) {
  const traceId = (req.headers['x-request-id'] as string) || (res.locals?.requestId as string) || undefined;
  const payload: AppErrorJSON = { error: { code: 'NOT_FOUND', message: 'Route not found.', traceId } };
  res.status(404).json(payload);
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return; // let Express handle

  const traceId = (req.headers['x-request-id'] as string) || (res.locals?.requestId as string) || undefined;

  // Map Zod
  if (err instanceof ZodError) {
    const e = errors.validation(zodDetails(err));
    const payload: AppErrorJSON = { error: { code: e.code, message: e.message, details: e.details, traceId } };
    return res.status(e.status).json(payload);
  }

  // Known AppError
  if (err instanceof AppError) {
    const payload: AppErrorJSON = { error: { code: err.code, message: err.expose ? err.message : 'Unexpected server error.', traceId } };
    if (err.details !== undefined && err.expose) payload.error.details = err.details;
    return res.status(err.status).json(payload);
  }

  // express-rate-limit (handler-less) or generic errors might put status on err
  const anyErr = err as any;
  if (typeof anyErr?.status === 'number') {
    const status = anyErr.status;
    const code = status === 429 ? 'RATE_LIMITED' : (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_FAILED');
    const message =
      status === 429 ? 'Too many requests, please try again later.' :
      status >= 500 ? 'Unexpected server error.' :
      anyErr.message || 'Request validation failed.';
    const payload: AppErrorJSON = { error: { code, message, traceId } };
    return res.status(status).json(payload);
  }

  // Fallback
  const fallback = errors.internal();
  const payload: AppErrorJSON = { error: { code: fallback.code, message: fallback.message, traceId } };
  return res.status(fallback.status).json(payload);
}
