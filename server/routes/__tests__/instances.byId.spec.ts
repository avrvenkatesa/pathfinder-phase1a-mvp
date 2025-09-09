import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import { app, appReady } from "../../index";
import { db } from "../../db";
import { sql } from "drizzle-orm";

let existingInstanceId: string | null = null;

async function fetchAnyInstanceId(): Promise<string | null> {
  const res: any = await db.execute(
    sql`select id from workflow_instances order by updated_at desc limit 1`
  );
  const row = res?.rows?.[0] ?? res?.[0];
  return row?.id ?? null;
}

beforeAll(async () => {
  await appReady;
  existingInstanceId = await fetchAnyInstanceId();
});

describe("GET /api/instances/:id", () => {
  it("returns 400 for an invalid uuid", async () => {
    const res = await request(app)
      .get("/api/instances/not-a-uuid")
      .set("X-Test-Auth", "1");
    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("BadRequest");
  });

  it("returns 404 for a valid-but-nonexistent uuid", async () => {
    const res = await request(app)
      .get("/api/instances/00000000-0000-4000-8000-000000000000")
      .set("X-Test-Auth", "1");
    expect(res.status).toBe(404);
    expect(res.body?.error).toBe("NotFound");
  });

  it("returns 200 and the expected shape for an existing instance", async () => {
    if (!existingInstanceId) {
      console.warn("[test] No workflow_instances found; run the seed then re-run tests.");
      return;
    }
    const res = await request(app)
      .get(`/api/instances/${existingInstanceId}`)
      .set("X-Test-Auth", "1");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: existingInstanceId,
      definitionId: expect.any(String),
      status: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      summary: {
        totalSteps: expect.any(Number),
        completedSteps: expect.any(Number),
        runningSteps: expect.any(Number),
        failedSteps: expect.any(Number),
        pendingSteps: expect.any(Number),
      },
    });
  });
});