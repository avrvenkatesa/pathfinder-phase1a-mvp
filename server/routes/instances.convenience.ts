import request from "supertest";
import { sql } from "drizzle-orm";
import { db } from "../../db";
import { app } from "../../index";

// Grab a real instance and its step_instances in sequence order
async function getChainFromDb() {
  const instQ: any = await db.execute(sql`
    select id
    from workflow_instances
    order by updated_at desc
    limit 1
  `);
  const instanceId = instQ.rows?.[0]?.id ?? instQ[0]?.id;

  const stepsQ: any = await db.execute(sql`
    select si.id as "stepInstanceId",
           ws.sequence as seq,
           si.status
    from step_instances si
    join workflow_steps ws on ws.id = si.step_id
    where si.workflow_instance_id = ${instanceId}::uuid
    order by ws.sequence asc
    limit 3
  `);

  const [s1, s2, s3] = stepsQ.rows ?? stepsQ;
  return {
    instanceId,
    s1: s1.stepInstanceId,
    s2: s2.stepInstanceId,
    s3: s3.stepInstanceId,
  };
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
    const { instanceId, s1, s2, s3 } = await getChainFromDb();

    // s3 cannot complete yet (blocked by s1/s2)
    let r = await request(app)
      .post(`/api/instances/${instanceId}/steps/${s3}/complete`)
      .expect(409);
    expect(r.body?.error ?? r.body?.code ?? "").toMatch(/(NotReady|DEP|blocked)/i);

    // Advance s1
    r = await request(app)
      .post(`/api/instances/${instanceId}/steps/${s1}/advance`)
      .expect(200);
    expect((r.body.step || r.body.stepInstance || r.body).status?.toLowerCase?.()).toBe("in_progress");

    // Complete s1
    r = await request(app)
      .post(`/api/instances/${instanceId}/steps/${s1}/complete`)
      .expect(200);
    expect((r.body.step || r.body.stepInstance || r.body).status?.toLowerCase?.()).toBe("completed");

    // Now s2 can advance
    r = await request(app)
      .post(`/api/instances/${instanceId}/steps/${s2}/advance`)
      .expect(200);
    expect((r.body.step || r.body.stepInstance || r.body).status?.toLowerCase?.()).toBe("in_progress");

    // s3 still cannot complete until s2 is completed
    r = await request(app)
      .post(`/api/instances/${instanceId}/steps/${s3}/complete`)
      .expect(409);

    // Complete s2
    r = await request(app)
      .post(`/api/instances/${instanceId}/steps/${s2}/complete`)
      .expect(200);
    expect((r.body.step || r.body.stepInstance || r.body).status?.toLowerCase?.()).toBe("completed");

    // Now s3 can advance and complete
    r = await request(app)
      .post(`/api/instances/${instanceId}/steps/${s3}/advance`)
      .expect(200);

    r = await request(app)
      .post(`/api/instances/${instanceId}/steps/${s3}/complete`)
      .expect(200);
    expect((r.body.step || r.body.stepInstance || r.body).status?.toLowerCase?.()).toBe("completed");
  });
});
