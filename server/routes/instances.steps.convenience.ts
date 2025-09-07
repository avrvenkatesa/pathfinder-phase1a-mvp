// server/routes/instances.steps.convenience.ts
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";

const router = Router();

/** 404 if the step doesn't belong to the instance */
async function ensurePair(instanceId: string, stepInstanceId: string): Promise<boolean> {
  const q: any = await db.execute(sql`
    select 1
    from step_instances
    where id = ${stepInstanceId}::uuid
      and workflow_instance_id = ${instanceId}::uuid
    limit 1
  `);
  const row = q.rows?.[0] ?? q[0];
  return !!row;
}

/** Are there earlier-sequence steps that are not 'completed'? */
async function prevStepsIncomplete(instanceId: string, stepInstanceId: string): Promise<boolean> {
  const q: any = await db.execute(sql`
    with target as (
      select ws.sequence as seq
      from step_instances si
      join workflow_steps ws on ws.id = si.step_id
      where si.id = ${stepInstanceId}::uuid
        and si.workflow_instance_id = ${instanceId}::uuid
      limit 1
    )
    select exists(
      select 1
      from step_instances si
      join workflow_steps ws on ws.id = si.step_id
      where si.workflow_instance_id = ${instanceId}::uuid
        and ws.sequence < (select seq from target)
        and si.status <> 'completed'::step_status
    ) as blocked
  `);

  const row = q.rows?.[0] ?? q[0];
  return !!row?.blocked;
}

/** Fetch the step after change to include in the response */
async function selectStep(stepInstanceId: string) {
  const sel: any = await db.execute(sql`
    select
      id,
      workflow_instance_id as "instanceId",
      status,
      updated_at as "updatedAt",
      completed_at as "completedAt"
    from step_instances
    where id = ${stepInstanceId}::uuid
  `);
  return sel.rows?.[0] ?? sel[0] ?? null;
}

/**
 * POST /api/instances/:instanceId/steps/:stepInstanceId/advance
 * Transition: pending|ready|blocked -> in_progress
 */
router.post("/:instanceId/steps/:stepInstanceId/advance", async (req, res) => {
  try {
    const { instanceId, stepInstanceId } = req.params;

    if (!(await ensurePair(instanceId, stepInstanceId))) {
      return res.status(404).json({ error: "NotFound" });
    }

    if (await prevStepsIncomplete(instanceId, stepInstanceId)) {
      // 👇 This body must mention NotReady/DEP/blocked/sequence to satisfy the test regex
      return res.status(409).json({
        error: "NotReady",
        code: "DEP_NOT_READY",
        message: "Step is blocked by earlier sequence dependencies.",
      });
    }

    await db.execute(sql`
      update step_instances
      set status = 'in_progress'::step_status,
          updated_at = now(),
          completed_at = null
      where id = ${stepInstanceId}::uuid
        and workflow_instance_id = ${instanceId}::uuid
    `);

    const step = await selectStep(stepInstanceId);
    return res.json({ step });
  } catch (err) {
    console.error("advance error:", err);
    return res.status(500).json({ error: "InternalServerError" });
  }
});

/**
 * POST /api/instances/:instanceId/steps/:stepInstanceId/complete
 * Transition: -> completed (when deps satisfied)
 */
router.post("/:instanceId/steps/:stepInstanceId/complete", async (req, res) => {
  try {
    const { instanceId, stepInstanceId } = req.params;

    if (!(await ensurePair(instanceId, stepInstanceId))) {
      return res.status(404).json({ error: "NotFound" });
    }

    if (await prevStepsIncomplete(instanceId, stepInstanceId)) {
      // 👇 Same: explicit JSON body with recognizable code/text
      return res.status(409).json({
        error: "NotReady",
        code: "DEP_NOT_READY",
        message: "Step is blocked by earlier sequence dependencies.",
      });
    }

    await db.execute(sql`
      update step_instances
      set status = 'completed'::step_status,
          updated_at = now(),
          completed_at = now()
      where id = ${stepInstanceId}::uuid
        and workflow_instance_id = ${instanceId}::uuid
    `);

    const step = await selectStep(stepInstanceId);
    return res.json({ step });
  } catch (err) {
    console.error("complete error:", err);
    return res.status(500).json({ error: "InternalServerError" });
  }
});

export default router;
