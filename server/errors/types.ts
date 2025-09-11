export type ErrorCode =
  | 'AUTH_MISSING'
  | 'AUTH_INVALID'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'CONFLICT'
  | 'PRECONDITION_REQUIRED'
  | 'PRECONDITION_FAILED'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface AppErrorJSON {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    traceId?: string;
  };
}

export class AppError extends Error {
  status: number;
  code: ErrorCode;
  details?: unknown;
  expose: boolean;

  constructor(opts: { status: number; code: ErrorCode; message: string; details?: unknown; expose?: boolean }) {
    super(opts.message);
    this.name = 'AppError';
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
    this.expose = opts.expose ?? (opts.status < 500);
  }
}
