// server/routes/steps-convenience.ts
import { Router } from "express";
import {
  advanceStepController,
  completeStepController,
} from "../controllers/steps";

export const stepsConvenienceRouter = Router();

/**
 * POST /api/instances/:id/steps/:stepId/advance
 * POST /api/instances/:id/steps/:stepId/complete
 */
stepsConvenienceRouter.post(
  "/api/instances/:id/steps/:stepId/advance",
  advanceStepController
);
stepsConvenienceRouter.post(
  "/api/instances/:id/steps/:stepId/complete",
  completeStepController
);
