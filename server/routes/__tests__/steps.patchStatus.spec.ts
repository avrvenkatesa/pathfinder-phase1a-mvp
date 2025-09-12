// server/routes/__tests__/steps.patchStatus.spec.ts
import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../../app";              // ⬅️ use the Express app (not ../../index)
import { db } from "../../db";
import { sql } from "drizzle-orm";

// Supertest sanity: fail fast if the export isn't an Express app
if (typeof (app as any) !== "function" || typeof (app as any).use !== "function") {
  throw new Error("Test app export is not an Express app. Import { app } from '../../app'.");
}

async function ensureOneStep(): Promise<{ instanceId: string; stepId: string }> {
  const inst: any = await db.execute(sql`
    select id from workflow_instances order by updated_at desc limit 1
  `);
  const instanceId = inst?.rows?.[0]?.id ?? inst?.[0]?.id;
  if (!instanceId) throw new Error("No workflow_instances found; run the seed to create data.");

  const stepSel: any = await db.execute(sql`
    select id from step_instances where workflow_instance_id = ${instanceId} limit 1
  `);
  const stepId = stepSel?.rows?.[0]?.id ?? stepSel?.[0]?.id;
  if (!stepId) throw new Error("No step_instances found; run the seed to create data.");

  return { instanceId, stepId };
}

let pair: { instanceId: string; stepId: string };

beforeAll(async () => {
  // No need to await appReady; tests import app directly.
  pair = await ensureOneStep();
});

describe("PATCH /api/instances/:id/steps/:stepId/status", () => {
  it("400 for invalid uuids", async () => {
    const res = await request(app)
      .patch(`/api/instances/not-a-uuid/steps/also-bad/status`)
      .set("X-Test-Auth", "1")
      .send({ status: "ready" });

    expect(res.status).toBe(400);
  });

  it("404 for non-existent pair", async () => {
    const res = await request(app)
      .patch(`/api/instances/00000000-0000-4000-8000-000000000000/steps/00000000-0000-4000-8000-000000000000/status`)
      .set("X-Test-Auth", "1")
      .send({ status: "ready" });

    expect(res.status).toBe(404);
  });

  it("409 for invalid transition", async () => {
    await db.execute(sql`
      update step_instances
         set status = 'ready'::step_status, updated_at = now(), completed_at = null
       where id = ${pair.stepId}
    `);

    await request(app)
      .patch(`/api/instances/${pair.instanceId}/steps/${pair.stepId}/status`)
      .set("X-Test-Auth", "1")
      .send({ status: "in_progress" })
      .expect(200);

    await request(app)
      .patch(`/api/instances/${pair.instanceId}/steps/${pair.stepId}/status`)
      .set("X-Test-Auth", "1")
      .send({ status: "completed" })
      .expect(200);

    const res = await request(app)
      .patch(`/api/instances/${pair.instanceId}/steps/${pair.stepId}/status`)
      .set("X-Test-Auth", "1")
      .send({ status: "in_progress" });

    expect(res.status).toBe(409);
  });

  it("200 for valid transition", async () => {
    await db.execute(sql`
      update step_instances
         set status = 'ready'::step_status, updated_at = now(), completed_at = null
       where id = ${pair.stepId}
    `);

    const res = await request(app)
      .patch(`/api/instances/${pair.instanceId}/steps/${pair.stepId}/status`)
      .set("X-Test-Auth", "1")
      .send({ status: "in_progress", reason: "manual-start" });

    expect(res.status).toBe(200);
    expect(res.body?.step?.status).toBe("in_progress");
  });
});
