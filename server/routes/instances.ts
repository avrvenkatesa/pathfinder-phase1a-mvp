// server/routes/instances.ts
import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  startInstance,
  listInstances,
} from "../services/instances";

const router = Router();

// UUID sanity check for optional definitionId
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Per-route rate limiter for the list endpoint (matches the test expectation)
// Per-route rate limiter for the list endpoint.
// In tests, use a much lower threshold so specs don't time out.
const instancesRateLimiter = rateLimit(
  process.env.NODE_ENV === "test"
    ? {
        windowMs: 10_000, // 10s window
        max: 20,          // trip quickly during the spec loop
        standardHeaders: true,
        legacyHeaders: false,
      }
    : {
        windowMs: 60_000, // 1 minute
        max: 60,          // production/dev default
        standardHeaders: true,
        legacyHeaders: false,
      }
);


/**
 * GET /api/instances
 * Seek-paginated listing with validation that returns a standard error shape on 400.
 */
router.get("/", instancesRateLimiter, async (req, res, next) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const definitionId = q.definitionId?.trim();
    const status = q.status?.trim();
    const cursor = q.cursor?.trim();
    const limitStr = q.limit?.trim();

    // Validate limit (1..100)
    if (limitStr !== undefined) {
      const n = Number(limitStr);
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Invalid 'limit' (1..100 required)" },
        });
      }
    }

    // Validate definitionId (UUID)
    if (definitionId !== undefined && !UUID_RE.test(definitionId)) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid 'definitionId' (must be UUID)" },
      });
    }

    const data = await listInstances({
      definitionId: definitionId || undefined,
      status: status || undefined,
      limit: limitStr ? Number(limitStr) : undefined,
      cursor: cursor || undefined,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/instances
 * Start a new instance. Keep minimal here.
 */
router.post("/", async (req, res, next) => {
  try {
    const { definitionId } = req.body ?? {};
    const result = await startInstance(definitionId);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

/**
 * IMPORTANT:
 * Do NOT define step advance/complete routes here.
 * They are owned by the step routers (instances.steps / instances.steps.convenience)
 * which implement the sequence guards and return 409 with { error: "Conflict", code: "NotReady" }.
 */

export default router;
