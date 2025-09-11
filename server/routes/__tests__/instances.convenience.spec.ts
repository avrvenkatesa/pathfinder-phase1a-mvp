import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import app from "../../app";
import { db } from "../../db";

type UUID = string;

// Helper to accept legacy or canonical error envelopes
function pickErrorText(body: any): string {
  if (!body) return "";
  if (typeof body.error === "string") return body.error;
  const e = body.error ?? {};
  return String(e.message ?? e.code ?? body.code ?? "");
}

async function ensureChain(): Promise<{ instanceId: UUID; s1: UUID; s2: UUID; s3: UUID }> {
  const rows: any = await db.execute(sql`
    with pick as (
      select wi.id as instance_id
      from workflow_instances wi
      join step_instances si on si.workflow_instance_id = wi.id
      join workflow_steps ws on ws.id = si.step_id
      group by wi.id
      having count(*) >= 3
      order by max(wi.updated_at) desc
      limit 1
    ),
    steps as (
      select
        si.id as step_instance_id,
        ws.sequence as seq
      from step_instances si
      join workflow_steps ws on ws.id = si.step_id
      where si.workflow_instance_id = (select instance_id from pick)
      order by ws.sequence asc
      limit 3
    )
    select * from steps;
  `);

  const instanceSel: any = await db.execute(sql`
    select wi.id
    from workflow_instances wi
    order by wi.updated_at desc
    limit 1
  `);

  const instanceId: UUID = instanceSel?.rows?.[0]?.id ?? (instanceSel as any)?.[0]?.id;

  const s1: UUID = rows.rows?.[0]?.step_instance_id ?? (rows as any)[0].step_instance_id;
  const s2: UUID = rows.rows?.[1]?.step_instance_id ?? (rows as any)[1].step_instance_id;
  const s3: UUID = rows.rows?.[2]?.step_instance_id ?? (rows as any)[2].step_instance_id;

  await db.execute(sql`
    update step_instances
    set status = 'pending'::step_status, updated_at = now(), completed_at = null
    where id in (${s1}::uuid, ${s2}::uuid, ${s3}::uuid)
  `);

  return { instanceId, s1, s2, s3 };
}

describe("Convenience endpoints (advance/complete)", () => {
  const OLD = process.env.CONTACTS_STUB;
  beforeAll(() => {
    process.env.CONTACTS_STUB = "true";
  });
  afterAll(() => {
    process.env.CONTACTS_STUB = OLD;
  });

  it("enforces sequence dependencies and transitions", async () => {
    const { instanceId, s1, s2, s3 } = await ensureChain();

    // cannot complete step3 first
    let r = await request(app)
      .post(`/api/instances/${instanceId}/steps/${s3}/complete`)
      .set("X-Test-Auth", "1")
      .set("Accept", "application/json")
      .set("Content-Type", "application/json")
      .expect(409);

    // accept legacy or canonical envelope
    expect(pickErrorText(r.body)).toMatch(/(NotReady|DEP|blocked|sequence)/i);

    // advance step1 -> in_progress
    r = await request(app)
      .post(`/api/instances/${instanceId}/steps/${s1}/advance`)
      .set("X-Test-Auth", "1")
      .set("Accept", "application/json")
      .expect(200);
    expect(r.body?.step?.status ?? r.body?.stepInstance?.status).toBe("in_progress");

    // complete step1
    r = await request(app)
      .post(`/api/instances/${instanceId}/steps/${s1}/complete`)
      .set("X-Test-Auth", "1")
      .set("Accept", "application/json")
      .expect(200);
    expect(r.body?.step?.status ?? r.body?.stepInstance?.status).toBe("completed");

    // advance step2
    r = await request(app)
      .post(`/api/instances/${instanceId}/steps/${s2}/advance`)
      .set("X-Test-Auth", "1")
      .set("Accept", "application/json")
      .expect(200);
    expect(r.body?.step?.status ?? r.body?.stepInstance?.status).toBe("in_progress");

    // still cannot complete step3
    await request(app)
      .post(`/api/instances/${instanceId}/steps/${s3}/complete`)
      .set("X-Test-Auth", "1")
      .set("Accept", "application/json")
      .expect(409);

    // complete step2
    r = await request(app)
      .post(`/api/instances/${instanceId}/steps/${s2}/complete`)
      .set("X-Test-Auth", "1")
      .set("Accept", "application/json")
      .expect(200);
    expect(r.body?.step?.status ?? r.body?.stepInstance?.status).toBe("completed");

    // now step3 can advance and complete
    r = await request(app)
      .post(`/api/instances/${instanceId}/steps/${s3}/advance`)
      .set("X-Test-Auth", "1")
      .set("Accept", "application/json")
      .expect(200);
    expect(r.body?.step?.status ?? r.body?.stepInstance?.status).toBe("in_progress");

    r = await request(app)
      .post(`/api/instances/${instanceId}/steps/${s3}/complete`)
      .set("X-Test-Auth", "1")
      .set("Accept", "application/json")
      .expect(200);
    expect(r.body?.step?.status ?? r.body?.stepInstance?.status).toBe("completed");
  });
});
