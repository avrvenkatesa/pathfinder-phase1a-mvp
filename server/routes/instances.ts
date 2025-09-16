// server/instances.ts
import { Router, type Request, type Response, type NextFunction } from "express";
import { listInstances, startInstance, cancelInstance } from "../services/instances";
import { rateLimiters } from "../middleware/rateLimiters";
import { validate, instancesListQuery } from "../middleware/validators";
import { errors } from "../errors";

const router = Router();

// UUID v4 validator (reuse pattern from instances.byId.ts)
const UUID_V4 = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

/**
 * GET /api/instances
 * Seek/cursor-paginated listing with input validation and rate limiting.
 * Accepts either ?seek=... or ?cursor=... (normalized to "cursor" for the service).
 */
router.get(
  "/",
  rateLimiters.instancesRead,          // <- required for the 429 test
  validate(instancesListQuery),        // <- required for the 400 validation tests
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>;

      // normalize both seek/cursor to "cursor"
      const cursor = (q.seek ?? q.cursor)?.trim() || undefined;

      // Build params without injecting undefined into string fields
      type ListParams = Partial<{
        definitionId: string;
        status: string;
        limit: number;
        cursor: string;
      }>;

      const params: ListParams = {};
      if (q.definitionId && q.definitionId.trim()) params.definitionId = q.definitionId.trim();
      if (q.status && q.status.trim()) params.status = q.status.trim();
      if (typeof q.limit === "string" && q.limit.length > 0) params.limit = Number(q.limit);
      if (cursor) params.cursor = cursor;

      const data = await listInstances(params as any); // param is Partial; service can accept optional fields
      return res.json(data);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/instances
 * Start a new instance. Require definitionId (return 400 if missing/blank).
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = (req.body ?? {}) as { definitionId?: string };
    const definitionId = typeof body.definitionId === "string" ? body.definitionId.trim() : "";

    if (!definitionId) {
      return next(
        errors.validation({
          issues: [
            { path: ["definitionId"], code: "invalid_type", message: "definitionId is required" },
          ],
        })
      );
    }

    const result = await startInstance(definitionId);
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/instances/:id
 * Cancel a workflow instance by setting status to 'cancelled'
 */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (!UUID_V4.test(id)) {
    return next(
      errors.validation({
        issues: [
          {
            path: ["id"],
            code: "invalid_uuid",
            message: "Invalid id (expected UUID v4)",
          },
        ],
      })
    );
  }

  try {
    const result = await cancelInstance(id);
    if (!result) {
      return next(errors.notFound("Instance"));
    }
    return res.status(200).json({ success: true, instance: result });
  } catch (err) {
    return next(err);
  }
});

export default router;
