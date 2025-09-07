// server/routes/instances.steps.ts
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";

const router = Router();

// UUID shape check (used by PATCH tests)
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Allowed transitions (lower-case enum values)
const ALLOWED: Record<string, string[]> = {
  pending: ["in_progress"],
  ready: ["in_progress"],
  blocked: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
};

/* -------------------------- Helpers -------------------------- */

// Resolve by *either* step_instances.id or workflow_steps.id (step_id).
// Prefer an exact step_instances.id match first, then most-recent row by step_id.
async function findStepByAny(stepParam: string) {
  const sel: any = await db.execute(sql`
    select
      si.id,
      si.workflow_instance_id,
      si.step_id,
      si.status,
      si.updated_at,
      si.completed_at
    from step_instances si
    where si.id::text = ${stepParam}
       or si.step_id::text = ${stepParam}
    order by
      case when si.id::text = ${stepParam} then 0 else 1 end,
      si.updated_at desc
    limit 1
  `);
  return sel.rows?.[0] ?? sel[0] ?? null;
}

// Strict pair (used by PATCH 404 test): (instanceId, workflow step id)
async function findStepByPair(instanceId: string, stepId: string) {
  const sel: any = await db.execute(sql`
    select
      si.id,
      si.workflow_instance_id,
      si.step_id,
      si.status,
      si.updated_at,
      si.completed_at
    from step_instances si
    where si.workflow_instance_id::text = ${instanceId}
      and si.step_id::text = ${stepId}
    limit 1
  `);
  return sel.rows?.[0] ?? sel[0] ?? null;
}

// Are there earlier-sequence steps (by workflow_steps.sequence) not completed?
async function prevStepsIncomplete(
  actualInstanceId: string,
  stepInstanceId: string
): Promise<boolean> {
  const q: any = await db.execute(sql`
    with target as (
      select ws.sequence as seq
      from step_instances si
      join workflow_steps ws on ws.id = si.step_id
      where si.id::text = ${stepInstanceId}
        and si.workflow_instance_id::text = ${actualInstanceId}
      limit 1
    )
    select exists(
      select 1
      from step_instances si
      join workflow_steps ws on ws.id = si.step_id
      where si.workflow_instance_id::text = ${actualInstanceId}
        and ws.sequence < (select seq from target)
        and si.status <> 'completed'::step_status
    ) as blocked;
  `);
  const row = q.rows?.[0] ?? q[0];
  return !!row?.blocked;
}

/* --------------------------- Routes -------------------------- */
/**
 * PATCH /:instanceId/steps/:stepId/status
 * Body: { status: "pending"|"ready"|"blocked"|"in_progress"|"completed", reason?: string }
 * NOTE: :stepId may be a workflow step id OR a step_instance id.
 */
router.patch("/:instanceId/steps/:stepId/status", async (req, res) => {
  try {
    const { instanceId, stepId } = req.params;
    const { status, reason } = req.body ?? {};

    // 400 for bad UUID shapes (suite expects this)
    if (!UUID_RE.test(instanceId) || !UUID_RE.test(stepId)) {
      return res.status(400).json({ error: "BadRequest", message: "Invalid UUID(s)" });
    }

    // Resolve strictly by pair first (instance, workflow step id)
    // Fallback: treat :stepId as a step_instance.id but ensure it belongs to :instanceId
    let cur = await findStepByPair(instanceId, stepId);
    if (!cur) {
      const byAny = await findStepByAny(stepId);
      if (!byAny || String(byAny.workflow_instance_id) !== String(instanceId)) {
        return res.status(404).json({ error: "NotFound", message: "Step instance not found" });
      }
      cur = byAny;
    }

    // 400 invalid status
    if (typeof status !== "string" || !(status in ALLOWED)) {
      return res.status(400).json({ error: "BadRequest", message: "Invalid status" });
    }

    const from: string = cur.status;
    const allowedTo = ALLOWED[from] ?? [];

    // 200 no-op if same
    if (from === status) {
      return res.json({
        step: {
          id: cur.id,
          instanceId: cur.workflow_instance_id,
          status: cur.status,
          updatedAt: cur.updated_at,
          completedAt: cur.completed_at,
        },
        changed: false,
        reason: reason ?? null,
      });
    }

    // 409 invalid transition
    if (!allowedTo.includes(status)) {
      return res.status(409).json({
        error: "InvalidTransition",
        from,
        to: status,
        allowed: allowedTo,
      });
    }

    // Apply transition
    if (status === "completed") {
      await db.execute(sql`
        update step_instances
        set status = 'completed'::step_status, updated_at = now(), completed_at = now()
        where id::text = ${String(cur.id)}
      `);
    } else if (status === "in_progress") {
      await db.execute(sql`
        update step_instances
        set status = 'in_progress'::step_status, updated_at = now(), completed_at = null
        where id::text = ${String(cur.id)}
      `);
    } else if (status === "ready") {
      await db.execute(sql`
        update step_instances
        set status = 'ready'::step_status, updated_at = now()
        where id::text = ${String(cur.id)}
      `);
    } else if (status === "blocked") {
      await db.execute(sql`
        update step_instances
        set status = 'blocked'::step_status, updated_at = now()
        where id::text = ${String(cur.id)}
      `);
    } else {
      await db.execute(sql`
        update step_instances
        set status = 'pending'::step_status, updated_at = now(), completed_at = null
        where id::text = ${String(cur.id)}
      `);
    }

    const out: any = await db.execute(sql`
      select id, workflow_instance_id as "instanceId", status, updated_at as "updatedAt", completed_at as "completedAt"
      from step_instances
      where id::text = ${String(cur.id)}
    `);

    return res.json({ step: out.rows?.[0] ?? out[0], changed: true, reason: reason ?? null });
  } catch (err) {
    console.error("PATCH /:instanceId/steps/:stepId/status error:", err);
    return res.status(500).json({ error: "InternalServerError" });
  }
});

/**
 * POST /:instanceId/steps/:stepInstanceId/advance
 * POST /:instanceId/steps/:stepInstanceId/complete
 * Accepts either step_instances.id **or** workflow step_id in the URL.
 * We resolve the actual row and then use its real instance id for dependency checks.
 */
router.post("/:instanceId/steps/:stepInstanceId/advance", async (req, res) => {
  const { stepInstanceId } = req.params;
  try {
    const row = await findStepByAny(stepInstanceId);
    if (!row) return res.status(404).json({ error: "NotFound" });

    const actualInstanceId = String(row.workflow_instance_id);

    if (await prevStepsIncomplete(actualInstanceId, String(row.id))) {
      return res.status(409).json({ error: "Conflict", code: "NotReady" });
    }

    await db.execute(sql`
      update step_instances
      set status = 'in_progress'::step_status, updated_at = now(), completed_at = null
      where id::text = ${String(row.id)}
    `);

    const out: any = await db.execute(sql`
      select id, workflow_instance_id as "instanceId", status, updated_at as "updatedAt", completed_at as "completedAt"
      from step_instances
      where id::text = ${String(row.id)}
    `);
    return res.json({ step: out.rows?.[0] ?? out[0] });
  } catch (err) {
    console.error("advance error", err);
    return res.status(500).json({ error: "InternalServerError" });
  }
});

router.post("/:instanceId/steps/:stepInstanceId/complete", async (req, res) => {
  const { stepInstanceId } = req.params;
  try {
    const row = await findStepByAny(stepInstanceId);
    if (!row) return res.status(404).json({ error: "NotFound" });

    const actualInstanceId = String(row.workflow_instance_id);

    if (await prevStepsIncomplete(actualInstanceId, String(row.id))) {
      return res.status(409).json({ error: "Conflict", code: "NotReady" });
    }

    await db.execute(sql`
      update step_instances
      set status = 'completed'::step_status, updated_at = now(), completed_at = now()
      where id::text = ${String(row.id)}
    `);

    const out: any = await db.execute(sql`
      select id, workflow_instance_id as "instanceId", status, updated_at as "updatedAt", completed_at as "completedAt"
      from step_instances
      where id::text = ${String(row.id)}
    `);
    return res.json({ step: out.rows?.[0] ?? out[0] });
  } catch (err) {
    console.error("complete error", err);
    return res.status(500).json({ error: "InternalServerError" });
  }
});

export default router;
