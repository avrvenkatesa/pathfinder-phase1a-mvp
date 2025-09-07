// server/services/steps.ts
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { stepInstances, stepDependencies } from "../db/schema";

/**
 * NOTE: This file assumes camelCase columns in your Drizzle schema:
 * - stepInstances: instanceId (uuid), stepId (uuid), status (text), updatedAt (timestamp)
 * - stepDependencies: stepId (uuid), dependsOnStepId (uuid)
 * If your columns are snake_case, adjust the references below.
 */

export type StepStatus = "PENDING" | "BLOCKED" | "IN_PROGRESS" | "COMPLETED";
type TransitionResult = { stepInstance: any; changed: boolean };

const ALLOWED_FORWARD: Record<StepStatus, StepStatus[]> = {
  PENDING: ["IN_PROGRESS"],
  BLOCKED: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
};

class ApiError extends Error {
  code: string;
  detail?: string;
  blockingDeps?: string[];
  constructor(code: string, message: string, detail?: string, blockingDeps?: string[]) {
    super(message);
    this.code = code;
    this.detail = detail;
    this.blockingDeps = blockingDeps;
  }
}

async function loadStepInstance(instanceId: string, stepId: string) {
  const rows = await db
    .select()
    .from(stepInstances)
    .where(and(eq(stepInstances.instanceId, instanceId), eq(stepInstances.stepId, stepId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Dependencies for `stepId` must be COMPLETED within the same instance.
 * Returns array of blocking dependency stepIds, if any.
 */
async function getBlockingDeps(instanceId: string, stepId: string): Promise<string[]> {
  const res = await db.execute(sql`
    SELECT d."dependsOnStepId" AS dep_id
    FROM ${stepDependencies} d
    LEFT JOIN ${stepInstances} si
      ON si."stepId" = d."dependsOnStepId" AND si."instanceId" = ${instanceId}
    WHERE d."stepId" = ${stepId}
      AND (si."status" IS NULL OR si."status" <> 'COMPLETED')
  `);

  const rows = (res as any).rows ?? (res as any);
  return rows.map((r: any) => r.dep_id);
}

async function applyTransition(
  instanceId: string,
  stepId: string,
  target: StepStatus
): Promise<{ updated: any; changed: boolean }> {
  const current = await loadStepInstance(instanceId, stepId);
  if (!current) throw new ApiError("NOT_FOUND", "Step instance not found");

  const from: StepStatus = current.status;
  const allowed = ALLOWED_FORWARD[from] ?? [];
  if (!allowed.includes(target)) {
    throw new ApiError("INVALID_TRANSITION", "Transition not allowed", `${from} -> ${target}`);
  }

  if (from === target) {
    return { updated: current, changed: false };
  }

  const updatedRows = await db
    .update(stepInstances)
    .set({ status: target, updatedAt: new Date() })
    .where(and(eq(stepInstances.instanceId, instanceId), eq(stepInstances.stepId, stepId)))
    .returning();

  const updated = updatedRows[0];
  return { updated, changed: updated?.status !== current.status };
}

export async function advanceStepService(
  instanceId: string,
  stepId: string,
  _req?: any
): Promise<TransitionResult> {
  if (!instanceId || !stepId) throw new ApiError("NOT_FOUND", "Missing ids");

  const blocking = await getBlockingDeps(instanceId, stepId);
  if (blocking.length) {
    throw new ApiError("DEP_NOT_READY", "Dependencies not complete", undefined, blocking);
  }

  const { updated, changed } = await applyTransition(instanceId, stepId, "IN_PROGRESS");
  return { stepInstance: updated, changed };
}

export async function completeStepService(
  instanceId: string,
  stepId: string,
  _req?: any
): Promise<TransitionResult> {
  if (!instanceId || !stepId) throw new ApiError("NOT_FOUND", "Missing ids");

  const blocking = await getBlockingDeps(instanceId, stepId);
  if (blocking.length) {
    throw new ApiError("DEP_NOT_READY", "Dependencies not complete", undefined, blocking);
  }

  const { updated, changed } = await applyTransition(instanceId, stepId, "COMPLETED");
  return { stepInstance: updated, changed };
}

export { ApiError };
