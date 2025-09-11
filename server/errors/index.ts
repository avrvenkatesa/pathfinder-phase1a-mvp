import { AppError, type ErrorCode } from './types';

export function err(status: number, code: ErrorCode, message: string, details?: unknown) {
  return new AppError({ status, code, message, details });
}

export const errors = {
  authMissing: () => err(401, 'AUTH_MISSING', 'Authentication required.'),
  authInvalid: () => err(401, 'AUTH_INVALID', 'Invalid or expired credentials.'),
  forbidden: () => err(403, 'FORBIDDEN', 'You do not have access to this resource.'),
  notFound: (what = 'Resource') => err(404, 'NOT_FOUND', `${what} not found.`),
  methodNotAllowed: () => err(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.'),
  conflict: (what = 'Resource') => err(409, 'CONFLICT', `${what} is in a conflicting state.`),
  preconditionRequired: () => err(428, 'PRECONDITION_REQUIRED', 'Missing required precondition (If-Match).'),
  preconditionFailed: () => err(412, 'PRECONDITION_FAILED', 'Precondition failed (stale or invalid ETag).'),
  validation: (details?: unknown) => err(400, 'VALIDATION_FAILED', 'Request validation failed.', details),
  rateLimited: () => err(429, 'RATE_LIMITED', 'Too many requests, please try again later.'),
  internal: () => err(500, 'INTERNAL_ERROR', 'Unexpected server error.'),
};
