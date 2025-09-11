// server/routes/instances.steps.ts
import { Router, type Request, type Response, type NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { errors } from "../errors";
import { AppError } from "../errors/types";

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
router.patch(
  "/:instanceId/steps/:stepId/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { instanceId, stepId } = req.params;

      if (!UUID_RE.test(instanceId) || !UUID_RE.test(stepId)) {
        return next(
          errors.validation({
            issues: [
              { path: ["instanceId"], code: "invalid_uuid", message: "Invalid UUID" },
              { path: ["stepId"], code: "invalid_uuid", message: "Invalid UUID" },
            ],
          })
        );
      }

      const pair = await getPair(instanceId, stepId);
      if (!pair) {
        return next(errors.notFound("Step"));
      }

      const from = pair.status;
      const targetRaw = String(req.body?.status ?? "").toLowerCase();
      const target = targetRaw as StepStatus;

      const allowed = ALLOWED_FORWARD[from] ?? [];
      if (!allowed.includes(target)) {
        return next(
          new AppError({
            status: 409,
            code: "CONFLICT",
            message: "INVALID_TRANSITION",
            details: { from, target, allowed },
          })
        );
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
      return next(err);
    }
  }
);

/**
 * POST /:instanceId/steps/:stepInstanceId/advance
 * - 409 when earlier steps are not completed
 * - 200 on success, sets status = in_progress
 */
router.post(
  "/:instanceId/steps/:stepInstanceId/advance",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { instanceId, stepInstanceId } = req.params;

      if (await prevStepsIncomplete(instanceId, stepInstanceId)) {
        // Keep recognizable words for existing tests: NotReady / blocked / sequence
        return next(
          new AppError({
            status: 409,
            code: "CONFLICT",
            message:
              "NotReady: Step is blocked by earlier sequence dependencies. (code=DEP_NOT_READY)",
            details: {
              reason: "NotReady",
              code: "DEP_NOT_READY",
              cause: "blocked_by_earlier_sequence",
            },
          })
        );
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
      return next(err);
    }
  }
);

/**
 * POST /:instanceId/steps/:stepInstanceId/complete
 * - 409 when earlier steps are not completed
 * - 200 on success, sets status = completed
 */
router.post(
  "/:instanceId/steps/:stepInstanceId/complete",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { instanceId, stepInstanceId } = req.params;

      if (await prevStepsIncomplete(instanceId, stepInstanceId)) {
        return next(
          new AppError({
            status: 409,
            code: "CONFLICT",
            message:
              "NotReady: Step is blocked by earlier sequence dependencies. (code=DEP_NOT_READY)",
            details: {
              reason: "NotReady",
              code: "DEP_NOT_READY",
              cause: "blocked_by_earlier_sequence",
            },
          })
        );
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
      return next(err);
    }
  }
);

export default router;
