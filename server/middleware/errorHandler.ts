import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

// Custom error classes
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(401, message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(403, message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(429, message, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: any) {
    super(500, message, 'DATABASE_ERROR', details);
    this.name = 'DatabaseError';
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    timestamp: string;
    path?: string;
    method?: string;
    details?: any;
    stack?: string;
    requestId?: string;
  };
}

// Log error details
const logError = (error: Error, req: Request) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    request: {
      method: req.method,
      url: req.url,
      params: req.params,
      query: req.query,
      body: req.body,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
      ip: req.ip,
      user: (req as any).user?.id,
    },
    requestId: (req as any).requestId,
  };

  // In production, send to logging service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to logging service (e.g., Sentry, LogRocket)
    console.error('Production Error:', JSON.stringify(errorLog));
  } else {
    console.error('Error Details:', errorLog);
  }
};

// Main error handler middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error
  logError(err, req);

  // Default error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      statusCode: 500,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      requestId: (req as any).requestId,
    },
  };

  // Handle different error types
  if (err instanceof AppError) {
    errorResponse.error.code = err.code || 'APP_ERROR';
    errorResponse.error.message = err.message;
    errorResponse.error.statusCode = err.statusCode;
    errorResponse.error.details = err.details;
  } else if (err instanceof ZodError) {
    errorResponse.error.code = 'VALIDATION_ERROR';
    errorResponse.error.message = 'Validation failed';
    errorResponse.error.statusCode = 400;
    errorResponse.error.details = err.errors;
  } else if (err instanceof TokenExpiredError) {
    errorResponse.error.code = 'TOKEN_EXPIRED';
    errorResponse.error.message = 'Authentication token has expired';
    errorResponse.error.statusCode = 401;
  } else if (err instanceof JsonWebTokenError) {
    errorResponse.error.code = 'INVALID_TOKEN';
    errorResponse.error.message = 'Invalid authentication token';
    errorResponse.error.statusCode = 401;
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    errorResponse.error.code = 'DUPLICATE_ERROR';
    errorResponse.error.message = 'Resource already exists';
    errorResponse.error.statusCode = 409;
    errorResponse.error.details = (err as any).errors;
  } else if (err.name === 'SequelizeValidationError') {
    errorResponse.error.code = 'VALIDATION_ERROR';
    errorResponse.error.message = 'Database validation failed';
    errorResponse.error.statusCode = 400;
    errorResponse.error.details = (err as any).errors;
  } else if (err.name === 'SequelizeDatabaseError') {
    errorResponse.error.code = 'DATABASE_ERROR';
    errorResponse.error.message = 'Database operation failed';
    errorResponse.error.statusCode = 500;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }

  // Send error response
  res.status(errorResponse.error.statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Not found handler
export const notFoundHandler = (req: Request, res: Response) => {
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      statusCode: 404,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  };

  res.status(404).json(errorResponse);
};