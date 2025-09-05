// server/routes/instances.byId.ts
import { Router, Request, Response } from "express";
import { getInstanceById } from "../services/instancesById";

const router = Router();

// UUID v4 validator (accepts lowercase/uppercase)
const UUID_V4 =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

/**
 * GET /api/instances/:id
 *
 * Returns instance detail + summary counts.
 * Response (200):
 * {
 *   id, definitionId, status, createdAt, updatedAt,
 *   summary: { totalSteps, completedSteps, runningSteps, failedSteps, pendingSteps }
 * }
 */
router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!UUID_V4.test(id)) {
    return res.status(400).json({
      error: "BadRequest",
      message: "Invalid id",
    });
  }

  try {
    const result = await getInstanceById(id);
    if (!result) {
      return res.status(404).json({
        error: "NotFound",
        message: "Instance not found",
      });
    }
    return res.status(200).json(result);
  } catch (err) {
    // If you have centralized error middleware, rethrow instead.
    return res.status(500).json({
      error: "InternalServerError",
      message: "Unexpected error fetching instance",
    });
  }
});

export default router;
