import { db } from "../db";
import { sql } from "drizzle-orm";

type StepStatus =
  | "pending" | "ready" | "in_progress" | "blocked"
  | "completed" | "cancelled" | "failed" | "skipped";

export type ProgressStep = {
  stepId: string | null;        // step_instances.id (may be null if not yet materialized)
  definitionStepId: string;     // workflow_steps.id
  name: string | null;
  type: string | null;          // step_type enum
  index: number;                // order across definition steps
  status: StepStatus | "pending";
  updatedAt: string | null;
  completedAt: string | null;
  blockedBy: string[];          // definition step ids this depends on
  isBlocked: boolean;
  isReady: boolean;
  isTerminal: boolean;
};

export type InstanceProgress = {
  instanceId: string;
  steps: ProgressStep[];
  summary: { total: number; completed: number; running: number; pending: number; };
};

export async function getInstanceProgress(instanceId: string): Promise<InstanceProgress | null> {
  // Ensure instance exists, get definition id
  const defRow: any = await db.execute(sql`
    select workflow_definition_id
      from workflow_instances
     where id = ${instanceId}
     limit 1
  `);
  const defId = defRow?.rows?.[0]?.workflow_definition_id ?? defRow?.[0]?.workflow_definition_id;
  if (!defId) return null;

  // Build progress rows with deps + runtime
  const rows: any = await db.execute(sql`
    with deps as (
      select sd.step_id, array_agg(sd.depends_on_step_id order by sd.depends_on_step_id) as blocked_by
        from step_dependencies sd
       group by sd.step_id
    ),
    si as (
      select id as step_instance_id, step_id, workflow_instance_id,
             status, updated_at, completed_at
        from step_instances
       where workflow_instance_id = ${instanceId}
    )
    select
      si.step_instance_id                      as step_id,
      ws.id                                    as definition_step_id,
      ws.name                                  as name,
      ws.type::text                            as type,
      (row_number() over (order by ws.id)) - 1 as idx,
      coalesce(si.status::text, 'pending')     as status,
      si.updated_at                            as updated_at,
      si.completed_at                          as completed_at,
      coalesce(d.blocked_by, '{}')             as blocked_by,
      coalesce(depcalc.has_unmet, false)       as is_blocked
    from workflow_steps ws
    left join si on si.step_id = ws.id
    left join deps d on d.step_id = ws.id
    left join lateral (
      select bool_or(sid.status is distinct from 'completed') as has_unmet
        from step_dependencies sd2
        left join si sid on sid.step_id = sd2.depends_on_step_id
       where sd2.step_id = ws.id
    ) depcalc on true
    where ws.workflow_definition_id = ${defId}
    order by idx asc, ws.id asc
  `);

  const steps: ProgressStep[] = (rows?.rows ?? rows ?? []).map((r: any) => {
    const status = (r.status ?? "pending") as StepStatus | "pending";
    const isTerminal = ["completed", "cancelled", "failed", "skipped"].includes(status);
    const isBlocked = !!r.is_blocked;
    const isReady = !isBlocked && ["pending","ready","blocked"].includes(status);

    const updatedAt = r.updated_at
      ? (r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at)).toISOString()
      : null;

    const completedAt = r.completed_at
      ? (r.completed_at instanceof Date ? r.completed_at : new Date(r.completed_at)).toISOString()
      : null;

    return {
      stepId: r.step_id ?? null,
      definitionStepId: r.definition_step_id,
      name: r.name ?? null,
      type: r.type ?? null,
      index: Number(r.idx) || 0,
      status,
      updatedAt,
      completedAt,
      blockedBy: Array.isArray(r.blocked_by) ? r.blocked_by : [],
      isBlocked,
      isReady,
      isTerminal,
    };
  });

  // Summary rollup
  const sumRow: any = await db.execute(sql`
    select
      count(ws.id) as total,
      count(*) filter (where si.status = 'completed') as completed,
      count(*) filter (where si.status in ('in_progress','ready')) as running,
      count(*) filter (where coalesce(si.status,'pending') in ('pending','blocked','skipped')) as pending
    from workflow_steps ws
    left join step_instances si
      on si.workflow_instance_id = ${instanceId} and si.step_id = ws.id
    where ws.workflow_definition_id = ${defId}
  `);

  const s = sumRow?.rows?.[0] ?? sumRow?.[0] ?? {};
  const summary = {
    total: Number(s.total ?? 0),
    completed: Number(s.completed ?? 0),
    running: Number(s.running ?? 0),
    pending: Number(s.pending ?? 0),
  };

  return { instanceId, steps, summary };
}
