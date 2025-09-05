import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import { app, appReady } from "../../index";
import { db } from "../../db";
import { sql } from "drizzle-orm";

async function ensureOneStep(): Promise<{ instanceId: string; stepId: string }> {
  // find any instance
  const inst: any = await db.execute(sql`
    select id from workflow_instances order by updated_at desc limit 1
  `);
  const instanceId = inst?.rows?.[0]?.id ?? inst?.[0]?.id;
  if (!instanceId) throw new Error("No workflow_instances found; run the seed to create data.");

  // find any step for that instance
  const stepSel: any = await db.execute(sql`
    select id from step_instances where workflow_instance_id = ${instanceId} limit 1
  `);
  const stepId = stepSel?.rows?.[0]?.id ?? stepSel?.[0]?.id;
  if (!stepId) throw new Error("No step_instances found; run the seed to create data.");

  return { instanceId, stepId };
}

let pair: { instanceId: string; stepId: string };

beforeAll(async () => {
  await appReady;
  pair = await ensureOneStep();
});

describe("PATCH /api/instances/:id/steps/:stepId/status", () => {
  it("400 for invalid uuids", async () => {
    const res = await request(app)
      .patch(`/api/instances/not-a-uuid/steps/also-bad/status`)
      .send({ status: "ready" });
    expect(res.status).toBe(400);
  });

  it("404 for non-existent pair", async () => {
    const res = await request(app)
      .patch(`/api/instances/00000000-0000-4000-8000-000000000000/steps/00000000-0000-4000-8000-000000000000/status`)
      .send({ status: "ready" });
    expect(res.status).toBe(404);
  });

  it("409 for invalid transition", async () => {
    // Start from a non-terminal state
    await db.execute(sql`
      update step_instances
         set status = 'ready'::step_status, updated_at = now(), completed_at = null
       where id = ${pair.stepId}
    `);

    // ready -> in_progress (allowed)
    await request(app)
      .patch(`/api/instances/${pair.instanceId}/steps/${pair.stepId}/status`)
      .send({ status: "in_progress" })
      .expect(200);

    // in_progress -> completed (allowed)
    await request(app)
      .patch(`/api/instances/${pair.instanceId}/steps/${pair.stepId}/status`)
      .send({ status: "completed" })
      .expect(200);

    // completed -> in_progress (invalid)
    const res = await request(app)
      .patch(`/api/instances/${pair.instanceId}/steps/${pair.stepId}/status`)
      .send({ status: "in_progress" });

    expect(res.status).toBe(409);
  });

  it("200 for valid transition", async () => {
    // Reset to a state that can move to in_progress
    await db.execute(sql`
      update step_instances
         set status = 'ready'::step_status, updated_at = now(), completed_at = null
       where id = ${pair.stepId}
    `);

    const res = await request(app)
      .patch(`/api/instances/${pair.instanceId}/steps/${pair.stepId}/status`)
      .send({ status: "in_progress", reason: "manual-start" });

    expect(res.status).toBe(200);
    expect(res.body?.step?.status).toBe("in_progress");
  });
});
