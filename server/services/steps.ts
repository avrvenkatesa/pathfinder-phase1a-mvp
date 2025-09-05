// server/services/steps.ts
import { db } from "../db";
import { sql } from "drizzle-orm";

export type StepStatus =
  | "pending" | "ready" | "in_progress" | "blocked"
  | "completed" | "cancelled" | "failed" | "skipped";

const ALLOWED: Record<StepStatus, StepStatus[]> = {
  pending:     ["ready","in_progress","blocked","cancelled","skipped"],
  ready:       ["in_progress","blocked","cancelled","skipped"],
  in_progress: ["blocked","completed","failed","cancelled","skipped"],
  blocked:     ["ready","in_progress","cancelled","skipped"],
  completed:   [],
  cancelled:   [],
  failed:      [],
  skipped:     [],
};

export async function patchStepStatus(args: {
  instanceId: string;
  stepId: string;
  status: StepStatus;
  reason?: string;
  metadata?: Record<string, any>;
}): Promise<
  | { kind: "ok"; step: { id: string; instanceId: string; status: StepStatus; updatedAt: string; completedAt: string | null } }
  | { kind: "not_found"; message: string }
  | { kind: "invalid_transition"; from: StepStatus; to: StepStatus }
> {
  const { instanceId, stepId, status: to } = args;

  // NOTE: schema uses workflow_instance_id (not instance_id)
  const sel: any = await db.execute(sql`
    select id, workflow_instance_id, status, updated_at, completed_at
      from step_instances
     where id = ${stepId} and workflow_instance_id = ${instanceId}
     limit 1
  `);
  const row = sel?.rows?.[0] ?? sel?.[0];
  if (!row) return { kind: "not_found", message: "Step not found for instance" };

  const from = row.status as StepStatus;

  // Idempotent if unchanged
  if (from === to) {
    return {
      kind: "ok",
      step: {
        id: row.id,
        instanceId: row.workflow_instance_id,
        status: from,
        updatedAt: (row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at)).toISOString(),
        completedAt: row.completed_at ? (row.completed_at instanceof Date ? row.completed_at : new Date(row.completed_at)).toISOString() : null,
      },
    };
  }

  // Validate transition
  if (!ALLOWED[from]?.includes(to)) {
    return { kind: "invalid_transition", from, to };
  }

  // Update (cast to enum; adjust completed_at when completing)
  const upd: any = await db.execute(sql`
    update step_instances
       set status = ${to}::step_status,
           updated_at = now(),
           completed_at = case when ${to} = 'completed' then now() else completed_at end
     where id = ${stepId} and workflow_instance_id = ${instanceId}
     returning id, workflow_instance_id, status, updated_at, completed_at
  `);
  const u = upd?.rows?.[0] ?? upd?.[0];

  return {
    kind: "ok",
    step: {
      id: u.id,
      instanceId: u.workflow_instance_id,
      status: u.status,
      updatedAt: (u.updated_at instanceof Date ? u.updated_at : new Date(u.updated_at)).toISOString(),
      completedAt: u.completed_at ? (u.completed_at instanceof Date ? u.completed_at : new Date(u.completed_at)).toISOString() : null,
    },
  };
}
