import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import { app, appReady } from "../../index";
import { db } from "../../db";
import { sql } from "drizzle-orm";

let existingInstanceId: string | null = null;

beforeAll(async () => {
  await appReady;
  const row: any = await db.execute(sql`
    select id from workflow_instances order by updated_at desc limit 1
  `);
  existingInstanceId = row?.rows?.[0]?.id ?? row?.[0]?.id ?? null;
});

describe("GET /api/instances/:id/progress", () => {
  it("returns 400 for invalid uuid", async () => {
    const res = await request(app).get("/api/instances/not-a-uuid/progress");
    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("BadRequest");
  });

  it("returns 404 for a valid-but-nonexistent uuid", async () => {
    const res = await request(app).get("/api/instances/00000000-0000-4000-8000-000000000000/progress");
    expect(res.status).toBe(404);
    expect(res.body?.error).toBe("NotFound");
  });

  it("returns 200 and progress payload for an existing instance", async () => {
    if (!existingInstanceId) {
      console.warn("[test] No instances; did you run the seed?");
      return;
    }
    const res = await request(app).get(`/api/instances/${existingInstanceId}/progress`);
    expect(res.status).toBe(200);

    // basic shape checks
    expect(res.body).toMatchObject({
      instanceId: existingInstanceId,
      summary: {
        total: expect.any(Number),
        completed: expect.any(Number),
        running: expect.any(Number),
        pending: expect.any(Number),
      },
    });

    expect(Array.isArray(res.body.steps)).toBe(true);
    if (res.body.steps.length > 0) {
      const s = res.body.steps[0];
      expect(s).toMatchObject({
        definitionStepId: expect.any(String),
        index: expect.any(Number),
        status: expect.any(String),
        blockedBy: expect.any(Array),
        isBlocked: expect.any(Boolean),
        isReady: expect.any(Boolean),
        isTerminal: expect.any(Boolean),
      });
      // stepId may be null if not yet materialized
      expect("stepId" in s).toBe(true);
    }
  });
});
