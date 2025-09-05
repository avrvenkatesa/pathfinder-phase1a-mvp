import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { patchStepStatus } from "../services/steps";

const router = Router();

const Uuid = z.string().uuid();
const PatchBody = z.object({
  status: z.enum([
    "pending","ready","in_progress","blocked","completed","cancelled","failed","skipped",
  ]),
  reason: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
});

router.patch("/:id/steps/:stepId/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instanceId = Uuid.parse(req.params.id);
    const stepId = Uuid.parse(req.params.stepId);
    const { status, reason, metadata } = PatchBody.parse(req.body ?? {});

    const result = await patchStepStatus({ instanceId, stepId, status, reason, metadata });

    if (result.kind === "not_found") {
      return res.status(404).json({ error: "NotFound", message: result.message });
    }
    if (result.kind === "invalid_transition") {
      return res.status(409).json({ error: "Conflict", message: `Invalid transition: ${result.from} → ${result.to}` });
    }
    return res.status(200).json({ step: result.step });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "BadRequest", message: err.errors?.[0]?.message ?? "Invalid request" });
    }
    return next(err);
  }
});

export default router;
