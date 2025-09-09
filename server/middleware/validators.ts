import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

/**
 * Query validator for GET /api/instances
 * Supports either ?seek=... or ?cursor=... (both optional),
 * limit 1..100, optional definitionId (uuid) and status enum.
 */
export const instancesListQuery = z.object({
  definitionId: z.string().uuid().optional(),
  status: z
    .enum(["pending", "running", "completed", "cancelled", "failed", "paused"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().max(512).optional(),
  seek: z.string().max(512).optional(),
});

function zodDetails(err: z.ZodError) {
  return err.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
    code: i.code,
  }));
}

/**
 * Minimal validator wrapper:
 * - Parses req.query against a Zod schema.
 * - On failure: 400 with { error: { code: 'VALIDATION_ERROR', ... } }
 * - On success: attaches parsed data to req.validated
 */
export function validate(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: zodDetails(parsed.error),
        },
      });
    }
    (req as any).validated = parsed.data;
    next();
  };
}
