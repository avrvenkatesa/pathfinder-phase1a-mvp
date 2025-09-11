// server/routes/instances.byId.ts
import { Router, Request, Response, NextFunction } from "express";
import { getInstanceById } from "../services/instancesById";
import { errors } from "../errors";

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
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
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
    const result = await getInstanceById(id);
    if (!result) {
      return next(errors.notFound("Instance"));
    }
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

export default router;
