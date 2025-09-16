import request from "supertest";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import app from "../../app";
import { db } from "../../db";
import { sql } from "drizzle-orm";

let existingInstanceId: string | null = null;
let runningInstanceId: string | null = null;

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

async function fetchRunningInstanceId(): Promise<string | null> {
  const res: any = await db.execute(
    sql`select id from workflow_instances where status = 'running' order by updated_at desc limit 1`
  );
  const row = res?.rows?.[0] ?? res?.[0];
  return row?.id ?? null;
}

async function fetchAnyInstanceId(): Promise<string | null> {
  const res: any = await db.execute(
    sql`select id from workflow_instances order by updated_at desc limit 1`
  );
  const row = res?.rows?.[0] ?? res?.[0];
  return row?.id ?? null;
}

async function getInstanceStatus(instanceId: string): Promise<string | null> {
  const res: any = await db.execute(
    sql`select status from workflow_instances where id = ${instanceId}`
  );
  const row = res?.rows?.[0] ?? res?.[0];
  return row?.status ?? null;
}

async function createRunningInstance(): Promise<string> {
  // Create a test instance in running state
  const res: any = await db.execute(
    sql`
      INSERT INTO workflow_instances (id, workflow_definition_id, status, started_at, created_at, updated_at)
      VALUES (gen_random_uuid(), '99999999-9999-4999-8999-999999999901', 'running', now(), now(), now())
      RETURNING id
    `
  );
  const row = res?.rows?.[0] ?? res?.[0];
  return row?.id;
}

beforeAll(async () => {
  existingInstanceId = await fetchAnyInstanceId();
  runningInstanceId = await fetchRunningInstanceId();
  
  // Create a running instance if none exists
  if (!runningInstanceId) {
    runningInstanceId = await createRunningInstance();
  }
});

beforeEach(async () => {
  // Reset any test instance to running state before each test
  if (runningInstanceId) {
    await db.execute(
      sql`
        UPDATE workflow_instances 
        SET status = 'running', completed_at = null, updated_at = now()
        WHERE id = ${runningInstanceId}
      `
    );
  }
});

describe("DELETE /api/instances/:id", () => {
  it("returns 400 for an invalid uuid", async () => {
    const res = await request(app)
      .delete("/api/instances/not-a-uuid")
      .set("X-Test-Auth", "1");
    
    expectErrorLike(res, 400, "BadRequest", [
      /validation/i,
      /invalid/i,
      /bad\s*request/i,
    ]);
  });

  it("returns 404 for a valid-but-nonexistent uuid", async () => {
    const res = await request(app)
      .delete("/api/instances/00000000-0000-4000-8000-000000000000")
      .set("X-Test-Auth", "1");
    
    expectErrorLike(res, 404, "NotFound", [/not\s*found/i, /missing/i, /unknown/i]);
  });

  it("successfully cancels a running instance", async () => {
    if (!runningInstanceId) {
      console.warn("[test] No running workflow_instances found; skipping test.");
      return;
    }

    // Verify initial state
    const initialStatus = await getInstanceStatus(runningInstanceId);
    expect(initialStatus).toBe("running");

    // Cancel the instance
    const res = await request(app)
      .delete(`/api/instances/${runningInstanceId}`)
      .set("X-Test-Auth", "1");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      instance: {
        id: runningInstanceId,
        status: "cancelled",
        completed_at: expect.any(String),
        updated_at: expect.any(String),
      },
    });

    // Verify the instance status was updated in the database
    const finalStatus = await getInstanceStatus(runningInstanceId);
    expect(finalStatus).toBe("cancelled");
  });
});
