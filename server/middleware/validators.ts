import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

export const UUID = z.string().uuid();

export const instancesListQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    seek: z.string().max(512).optional(),
    status: z
      .enum(["pending", "running", "completed", "cancelled", "failed", "paused"])
      .optional(),
    definitionId: z.string().uuid().optional(),
  })
  .strict();

export function validate(querySchema?: z.ZodTypeAny, paramsSchema?: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (paramsSchema) req.params = paramsSchema.parse(req.params);
      if (querySchema) req.query = querySchema.parse(req.query);
      return next();
    } catch (err: any) {
      return res.status(400).json({
        error: "BadRequest",
        message: "Invalid request",
        details: err?.errors ?? String(err),
      });
    }
  };
}

