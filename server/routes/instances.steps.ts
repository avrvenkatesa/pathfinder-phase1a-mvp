// server/routes/instances.steps.ts
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";

const router = Router();

// Basic UUID validator (keeps PATCH tests happy)
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StepStatus = "pending" | "ready" | "blocked" | "in_progress" | "completed";

const ALLOWED_FORWARD: Record<StepStatus, StepStatus[]> = {
  pending: ["in_progress"],
  ready: ["in_progress"],
  blocked: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
};

// ---------- Helpers ----------

/** Return the step-instance row for the given (instanceId, stepInstanceId) pair (or null). */
async function getPair(
  instanceId: string,
  stepInstanceId: string
): Promise<{ id: string; status: StepStatus } | null> {
  const res: any = await db.execute(sql`
    select id, status
    from step_instances
    where id = ${stepInstanceId}::uuid
      and workflow_instance_id = ${instanceId}::uuid
    limit 1
  `);
  const row = res.rows?.[0] ?? res[0] ?? null;
  return row ? { id: row.id, status: row.status } : null;
}

/** Are there earlier-sequence steps in the same instance that are not 'completed'? */
async function prevStepsIncomplete(
  instanceId: string,
  stepInstanceId: string
): Promise<boolean> {
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

// ---------- Routes ----------

/**
 * PATCH /:instanceId/steps/:stepId/status
 * Body: { status: "in_progress" | "completed" | ... }
 * - 400 invalid UUIDs
 * - 404 pair not found
 * - 409 invalid transition
 * - 200 on success, returns { step: { ... } }
 */
router.patch("/:instanceId/steps/:stepId/status", async (req, res) => {
  try {
    const { instanceId, stepId } = req.params;

    if (!UUID_RE.test(instanceId) || !UUID_RE.test(stepId)) {
      return res.status(400).json({ error: "BadRequest", message: "Invalid UUID(s)" });
    }

    const pair = await getPair(instanceId, stepId);
    if (!pair) {
      return res.status(404).json({ error: "NotFound", message: "Step not found" });
    }

    const from = pair.status;
    const targetRaw = String(req.body?.status ?? "").toLowerCase();
    const target = targetRaw as StepStatus;

    const allowed = ALLOWED_FORWARD[from] ?? [];
    if (!allowed.includes(target)) {
      return res.status(409).json({
        error: "INVALID_TRANSITION",
        from,
        target,
        allowed,
      });
    }

    await db.execute(sql`
      update step_instances
      set status = ${target}::step_status,
          updated_at = now(),
          completed_at = case when ${target}::text = 'completed' then now() else null end
      where id = ${stepId}::uuid
        and workflow_instance_id = ${instanceId}::uuid
    `);

    const out: any = await db.execute(sql`
      select id,
             workflow_instance_id as "instanceId",
             status,
             updated_at as "updatedAt",
             completed_at as "completedAt"
      from step_instances
      where id = ${stepId}::uuid
    `);

    return res.json({ step: out.rows?.[0] ?? out[0] });
  } catch (err) {
    console.error("PATCH status error:", err);
    return res.status(500).json({ error: "InternalServerError" });
  }
});

/**
 * POST /:instanceId/steps/:stepInstanceId/advance
 * - 409 when earlier steps are not completed
 * - 200 on success, sets status = in_progress
 */
router.post("/:instanceId/steps/:stepInstanceId/advance", async (req, res) => {
  try {
    const { instanceId, stepInstanceId } = req.params;

    // sequence-guard
    if (await prevStepsIncomplete(instanceId, stepInstanceId)) {
      return res.status(409).json({
        error: "NotReady", // important for the test
        code: "NotReady",
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

    const out: any = await db.execute(sql`
      select id,
             workflow_instance_id as "instanceId",
             status,
             updated_at as "updatedAt",
             completed_at as "completedAt"
      from step_instances
      where id = ${stepInstanceId}::uuid
    `);

    return res.json({ step: out.rows?.[0] ?? out[0] });
  } catch (err) {
    console.error("advance error:", err);
    return res.status(500).json({ error: "InternalServerError" });
  }
});

/**
 * POST /:instanceId/steps/:stepInstanceId/complete
 * - 409 when earlier steps are not completed
 * - 200 on success, sets status = completed
 */
router.post("/:instanceId/steps/:stepInstanceId/complete", async (req, res) => {
  try {
    const { instanceId, stepInstanceId } = req.params;

    // sequence-guard
    if (await prevStepsIncomplete(instanceId, stepInstanceId)) {
      return res.status(409).json({
        error: "NotReady", // important for the test
        code: "NotReady",
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

    const out: any = await db.execute(sql`
      select id,
             workflow_instance_id as "instanceId",
             status,
             updated_at as "updatedAt",
             completed_at as "completedAt"
      from step_instances
      where id = ${stepInstanceId}::uuid
    `);

    return res.json({ step: out.rows?.[0] ?? out[0] });
  } catch (err) {
    console.error("complete error:", err);
    return res.status(500).json({ error: "InternalServerError" });
  }
});

export default router;
