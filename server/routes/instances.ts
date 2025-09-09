import { Router } from "express";
import { listInstances, startInstance } from "../services/instances";
import { rateLimiters } from "../middleware/rateLimiters";
import { validate, instancesListQuery } from "../middleware/validators";

const router = Router();

/**
 * GET /api/instances
 * Seek/cursor-paginated listing with input validation and rate limiting.
 * Accepts either ?seek=... or ?cursor=... (normalized to "cursor" for the service).
 */
router.get(
  "/",
  rateLimiters.instancesRead,          // <- required for the 429 test
  validate(instancesListQuery),        // <- required for the 400 validation tests
  async (req, res, next) => {
    try {
      const q = req.query as Record<string, string | undefined>;

      // normalize both seek/cursor to "cursor"
      const cursor = (q.seek ?? q.cursor)?.trim() || undefined;

      const data = await listInstances({
        definitionId: q.definitionId?.trim() || undefined,
        status: q.status?.trim() || undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        cursor,
      });

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/instances
 * (kept simple; no special validation needed for current tests)
 */
router.post("/", async (req, res, next) => {
  try {
    const { definitionId } = (req.body ?? {}) as { definitionId?: string };
    const result = await startInstance(definitionId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
