// server/services/instancesById.ts
import { db } from "../db";
import { sql } from "drizzle-orm";

export type InstanceSummary = {
  totalSteps: number;
  completedSteps: number;
  runningSteps: number;
  failedSteps: number;
  pendingSteps: number;
};

export type InstanceDetail = {
  id: string;
  definitionId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  summary: InstanceSummary;
};

const toNum = (x: any) => (x == null ? 0 : Number(x));
const isUndefinedColumn = (e: any) =>
  e?.code === "42703" || /column .* does not exist/i.test(String(e?.message || ""));

// Build the SQL string for a given set of column names, but ALWAYS alias to common names.
function buildQuery({
  defCol,
  joinCol,
  createdCol,
  updatedCol,
  id,
}: {
  defCol: string;
  joinCol: string;
  createdCol: string;
  updatedCol: string;
  id: string;
}) {
  return `
    SELECT
      wi.id,
      wi.${defCol}        AS definition_id,
      wi.status           AS status,
      wi.${createdCol}    AS created_at,
      wi.${updatedCol}    AS updated_at,
      COALESCE(COUNT(si.id), 0)                                                    AS total_steps,
      COALESCE(COUNT(*) FILTER (WHERE si.status = 'completed'), 0)                 AS completed_steps,
      COALESCE(COUNT(*) FILTER (WHERE si.status IN ('in_progress','ready')), 0)    AS running_steps,
      COALESCE(COUNT(*) FILTER (WHERE si.status = 'failed'), 0)                    AS failed_steps,
      COALESCE(COUNT(*) FILTER (WHERE si.status IN ('pending','blocked','skipped')), 0) AS pending_steps
    FROM workflow_instances wi
    LEFT JOIN step_instances si ON si.${joinCol} = wi.id
    WHERE wi.id = '${id}'
    GROUP BY wi.id
    LIMIT 1
  `;
}

export async function getInstanceById(instanceId: string): Promise<InstanceDetail | null> {
  // Try common shape #1: definition_id / instance_id
  const q1 = buildQuery({
    defCol: "definition_id",
    joinCol: "instance_id",
    createdCol: "created_at",
    updatedCol: "updated_at",
    id: instanceId,
  });

  try {
    const res1: any = await db.execute(sql.raw(q1));
    const row1 = res1?.rows?.[0] ?? res1?.[0];
    if (!row1) return null;

    const created = row1.created_at instanceof Date ? row1.created_at.toISOString() : String(row1.created_at);
    const updated = row1.updated_at instanceof Date ? row1.updated_at.toISOString() : String(row1.updated_at);

    return {
      id: row1.id,
      definitionId: row1.definition_id, // <- unified alias
      status: row1.status,
      createdAt: created,
      updatedAt: updated,
      summary: {
        totalSteps: toNum(row1.total_steps),
        completedSteps: toNum(row1.completed_steps),
        runningSteps: toNum(row1.running_steps),
        failedSteps: toNum(row1.failed_steps),
        pendingSteps: toNum(row1.pending_steps),
      },
    };
  } catch (e) {
    if (!isUndefinedColumn(e)) {
      console.error("[instancesById] query #1 failed:", e);
      throw e;
    }
  }

  // Try common shape #2: workflow_definition_id / workflow_instance_id
  const q2 = buildQuery({
    defCol: "workflow_definition_id",
    joinCol: "workflow_instance_id",
    createdCol: "created_at",
    updatedCol: "updated_at",
    id: instanceId,
  });

  try {
    const res2: any = await db.execute(sql.raw(q2));
    const row2 = res2?.rows?.[0] ?? res2?.[0];
    if (!row2) return null;

    const created = row2.created_at instanceof Date ? row2.created_at.toISOString() : String(row2.created_at);
    const updated = row2.updated_at instanceof Date ? row2.updated_at.toISOString() : String(row2.updated_at);

    return {
      id: row2.id,
      definitionId: row2.definition_id, // <- unified alias from buildQuery()
      status: row2.status,
      createdAt: created,
      updatedAt: updated,
      summary: {
        totalSteps: toNum(row2.total_steps),
        completedSteps: toNum(row2.completed_steps),
        runningSteps: toNum(row2.running_steps),
        failedSteps: toNum(row2.failed_steps),
        pendingSteps: toNum(row2.pending_steps),
      },
    };
  } catch (e) {
    console.error("[instancesById] query #2 failed:", e);
    throw e;
  }
}
