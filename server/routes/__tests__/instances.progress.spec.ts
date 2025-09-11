import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import app from "../../app";
import { db } from "../../db";
import { sql } from "drizzle-orm";

let existingInstanceId: string | null = null;

// Helpers to accept legacy or canonical error envelopes
function pickErrorText(body: any): string {
  if (!body) return "";
  if (typeof body.error === "string") return body.error; // legacy: { error: "BadRequest" }
  const e = body.error ?? {};
  return String(e.message ?? e.code ?? body.code ?? "");
}
function expectErrorLike(
  res: any,
  expectedStatus: number,
  legacyExact: string,
  canonicalPatterns: RegExp[]
) {
  expect(res.status).toBe(expectedStatus);
  const text = pickErrorText(res.body);
  const ok =
    text === legacyExact || canonicalPatterns.some((rx) => rx.test(String(text)));
  expect(ok).toBe(true);
}

beforeAll(async () => {
  const row: any = await db.execute(sql`
    select id from workflow_instances order by updated_at desc limit 1
  `);
  existingInstanceId = row?.rows?.[0]?.id ?? row?.[0]?.id ?? null;
});

describe("GET /api/instances/:id/progress", () => {
  it("returns 400 for invalid uuid", async () => {
    const res = await request(app)
      .get("/api/instances/not-a-uuid/progress")
      .set("X-Test-Auth", "1");
    expectErrorLike(res, 400, "BadRequest", [/validation/i, /invalid/i, /bad\s*request/i]);
  });

  it("returns 404 for a valid-but-nonexistent uuid", async () => {
    const res = await request(app)
      .get("/api/instances/00000000-0000-4000-8000-000000000000/progress")
      .set("X-Test-Auth", "1");
    expectErrorLike(res, 404, "NotFound", [/not\s*found/i, /missing/i, /unknown/i]);
  });

  it("returns 200 and progress payload for an existing instance", async () => {
    if (!existingInstanceId) {
      console.warn("[test] No instances; did you run the seed?");
      return;
    }
    const res = await request(app)
      .get(`/api/instances/${existingInstanceId}/progress`)
      .set("X-Test-Auth", "1");
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
      expect("stepId" in s).toBe(true); // may be null if not materialized
    }
  });
});
