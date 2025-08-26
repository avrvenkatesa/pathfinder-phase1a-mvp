import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { sendError } from './response-helpers';

export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(res, 400, 'VALIDATION_ERROR', error.errors[0].message);
      }
      return sendError(res, 500, 'INTERNAL_ERROR', 'Validation failed');
    }
  };
};

export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(res, 400, 'VALIDATION_ERROR', error.errors[0].message);
      }
      return sendError(res, 500, 'INTERNAL_ERROR', 'Validation failed');
    }
  };
};

export const validateParams = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(res, 400, 'VALIDATION_ERROR', error.errors[0].message);
      }
      return sendError(res, 500, 'INTERNAL_ERROR', 'Validation failed');
    }
  };
};