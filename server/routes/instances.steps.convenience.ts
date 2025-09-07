// server/routes/instances.steps.convenience.ts
import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { stepInstances, stepDependencies } from "../db/schema";
import { and, eq, or } from "drizzle-orm";

const router = Router();

// Build an OR condition that matches either workflowInstanceId or instanceId
function instMatch(instanceId: string) {
  // @ts-ignore – support both schema shapes
  const hasWorkflow = "workflowInstanceId" in stepInstances;
  // @ts-ignore
  const hasInstance = "instanceId" in stepInstances;

  if (hasWorkflow && hasInstance) {
    // @ts-ignore
    return or(eq(stepInstances.workflowInstanceId, instanceId), eq(stepInstances.instanceId, instanceId));
  }
  if (hasWorkflow) {
    // @ts-ignore
    return eq(stepInstances.workflowInstanceId, instanceId);
  }
  // @ts-ignore
  return eq(stepInstances.instanceId, instanceId);
}

/**
 * Resolve a step instance by either:
 *  - concrete step instance id (step_instances.id), or
 *  - definition step id (step_instances.step_id),
 * for the given workflow instance.
 */
async function resolveStepInstance(instanceId: string, stepOrStepInstanceId: string) {
  // try by concrete step-instance id
  const bySiId = await db
    .select()
    .from(stepInstances)
    .where(and(instMatch(instanceId), eq(stepInstances.id, stepOrStepInstanceId)))
    .limit(1);
  if (bySiId.length) return bySiId[0];

  // fallback: definition step id
  const byDefId = await db
    .select()
    .from(stepInstances)
    .where(and(instMatch(instanceId), eq(stepInstances.stepId, stepOrStepInstanceId)))
    .limit(1);
  return byDefId[0];
}

// POST /api/instances/:id/steps/:stepId/complete
router.post("/:id/steps/:stepId/complete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, stepId } = req.params;

    const si = await resolveStepInstance(id, stepId);
    if (!si) return res.status(404).json({ error: "NotFound", message: "Step instance not found" });

    // Fetch dependencies for this step's definition (si.stepId) scoped to this instance
    const deps = await db
      .select({
        dependsOn: stepDependencies.dependsOnStepId,
        depStatus: stepInstances.status,
      })
      .from(stepDependencies)
      .leftJoin(
        stepInstances,
        and(instMatch(id), eq(stepInstances.stepId, stepDependencies.dependsOnStepId))
      )
      .where(eq(stepDependencies.stepId, si.stepId));

    // Treat anything not "completed" as blocking
    const blocking = deps.filter((d) => (d.depStatus ?? null) !== "completed");
    if (blocking.length) {
      return res.status(409).json({
        error: "NotReady",
        code: "DEP_NOT_READY",
        blockingDeps: blocking.map((b) => b.dependsOn),
      });
    }

    const [updated] = await db
      .update(stepInstances)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(stepInstances.id, si.id)) // update by concrete step_instance id
      .returning();

    return res.json({ stepInstance: updated });
  } catch (e) {
    next(e);
  }
});

// POST /api/instances/:id/steps/:stepId/advance
router.post("/:id/steps/:stepId/advance", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, stepId } = req.params;

    const si = await resolveStepInstance(id, stepId);
    if (!si) return res.status(404).json({ error: "NotFound", message: "Step instance not found" });

    if (si.status === "completed") {
      return res.status(409).json({ error: "InvalidTransition", from: si.status, to: "in_progress" });
    }

    const [updated] = await db
      .update(stepInstances)
      .set({ status: "in_progress", startedAt: si.startedAt ?? new Date() })
      .where(eq(stepInstances.id, si.id))
      .returning();

    return res.json({ stepInstance: updated });
  } catch (e) {
    next(e);
  }
});

export default router;
