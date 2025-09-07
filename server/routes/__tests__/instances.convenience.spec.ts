  import { describe, it, expect, beforeAll, afterAll } from "vitest";
  import request from "supertest";
  import { sql } from "drizzle-orm";
  import { app } from "../../app";
  import { db } from "../../db";

  type UUID = string;

  async function ensureChain(): Promise<{ instanceId: UUID, s1: UUID, s2: UUID, s3: UUID }> {
    // pick any instance that has >= 3 steps with sequences 1..3
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

    // normalize first 3 steps (pending)
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

      // CANNOT complete step3 while earlier ones are not completed
      let r = await request(app)
        .post(`/api/instances/${instanceId}/steps/${s3}/complete`)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .expect(409);

      // Debug output
      console.log('==================== DEBUG ====================');
      console.log('URL:', `/api/instances/${instanceId}/steps/${s3}/complete`);
      console.log('Status:', r.status);
      console.log('Headers:', r.headers);
      console.log('Body type:', typeof r.body);
      console.log('Body:', JSON.stringify(r.body));
      console.log('Text:', r.text);
      console.log('================================================');

      // Debug what we're testing
      const errorValue = r.body?.error ?? r.body?.code ?? "";
      console.log('Error value being tested:', errorValue);
      console.log('Is it empty string?', errorValue === "");

      if (r.text === 'Conflict') {
        console.log('WARNING: Getting default 409 text instead of JSON response');
        console.log('This means the route handler is not sending JSON properly');
      }

      expect(r.body?.error ?? r.body?.code ?? "").toMatch(/(NotReady|DEP|blocked|sequence)/i);

      // advance step1 -> in_progress
      r = await request(app)
        .post(`/api/instances/${instanceId}/steps/${s1}/advance`)
        .set('Accept', 'application/json')
        .expect(200);

      console.log('Step1 advance response:', JSON.stringify(r.body));
      expect(r.body?.step?.status ?? r.body?.stepInstance?.status).toBe("in_progress");

      // complete step1
      r = await request(app)
        .post(`/api/instances/${instanceId}/steps/${s1}/complete`)
        .set('Accept', 'application/json')
        .expect(200);
      expect(r.body?.step?.status ?? r.body?.stepInstance?.status).toBe("completed");

      // advance step2
      r = await request(app)
        .post(`/api/instances/${instanceId}/steps/${s2}/advance`)
        .set('Accept', 'application/json')
        .expect(200);
      expect(r.body?.step?.status ?? r.body?.stepInstance?.status).toBe("in_progress");

      // cannot complete step3 until step2 is completed
      r = await request(app)
        .post(`/api/instances/${instanceId}/steps/${s3}/complete`)
        .set('Accept', 'application/json')
        .expect(409);

      // complete step2
      r = await request(app)
        .post(`/api/instances/${instanceId}/steps/${s2}/complete`)
        .set('Accept', 'application/json')
        .expect(200);
      expect(r.body?.step?.status ?? r.body?.stepInstance?.status).toBe("completed");

      // now step3 can advance and then complete
      r = await request(app)
        .post(`/api/instances/${instanceId}/steps/${s3}/advance`)
        .set('Accept', 'application/json')
        .expect(200);
      expect(r.body?.step?.status ?? r.body?.stepInstance?.status).toBe("in_progress");

      r = await request(app)
        .post(`/api/instances/${instanceId}/steps/${s3}/complete`)
        .set('Accept', 'application/json')
        .expect(200);
      expect(r.body?.step?.status ?? r.body?.stepInstance?.status).toBe("completed");
    });
  });
