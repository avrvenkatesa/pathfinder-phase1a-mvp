// server/services/instancesById.ts
import { db } from "../db";
import { sql, eq } from "drizzle-orm";
import {
  workflow_instances as wi,
  step_instances as si,
} from "../db/schema";

/**
 * Adjust these types if you keep extra fields on instances.
 */
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

const toNum = (x: unknown) => (x == null ? 0 : Number(x));

/**
 * Returns a single workflow instance with computed step summary counts.
 * Assumes `instanceId` is a valid UUID (router validates).
 *
 * NOTE: This file assumes your Drizzle schema exports the following fields:
 *  - workflow_instances: id, definitionId, status, createdAt, updatedAt
 *  - step_instances:     id, instanceId, status
 * If your schema uses snake_case (e.g. definition_id), change the select below
 * to use those fields but keep the returned JSON camelCased.
 */
export async function getInstanceById(instanceId: string): Promise<InstanceDetail | null> {
  const rows = await db
    .select({
      id: wi.id,
      definitionId: wi.definitionId,  // change to wi.definition_id if your schema uses snake_case
      status: wi.status,
      createdAt: wi.createdAt,        // or wi.created_at
      updatedAt: wi.updatedAt,        // or wi.updated_at
      totalSteps: sql<number>`COALESCE(COUNT(${si.id}), 0)`,
      completedSteps: sql<number>`COALESCE(COUNT(*) FILTER (WHERE ${si.status} = 'completed'), 0)`,
      runningSteps: sql<number>`COALESCE(COUNT(*) FILTER (WHERE ${si.status} IN ('in_progress','ready')), 0)`,
      failedSteps: sql<number>`COALESCE(COUNT(*) FILTER (WHERE ${si.status} = 'failed'), 0)`,
      pendingSteps: sql<number>`COALESCE(COUNT(*) FILTER (WHERE ${si.status} IN ('pending','blocked','skipped')), 0)`,
    })
    .from(wi)
    .leftJoin(
      si,
      eq(si.instanceId, wi.id) // change to si.instance_id if your schema uses snake_case
    )
    .where(eq(wi.id, instanceId))
    .groupBy(wi.id)
    .limit(1);

  if (!rows.length) return null;
  const r = rows[0];

  return {
    id: r.id as unknown as string,
    definitionId: r.definitionId as unknown as string,
    status: r.status as unknown as string,
    createdAt: (r.createdAt as any)?.toISOString?.() ?? String(r.createdAt),
    updatedAt: (r.updatedAt as any)?.toISOString?.() ?? String(r.updatedAt),
    summary: {
      totalSteps: toNum(r.totalSteps),
      completedSteps: toNum(r.completedSteps),
      runningSteps: toNum(r.runningSteps),
      failedSteps: toNum(r.failedSteps),
      pendingSteps: toNum(r.pendingSteps),
    },
  };
}
