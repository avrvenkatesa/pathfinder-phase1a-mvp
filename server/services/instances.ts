// server/services/instances.ts
import { pool } from '../db';
import { assertUUID } from '../utils/validators';

// Start an instance: create workflow_instances row, seed step_instances
export async function startInstance(definitionId: string) {
    assertUUID(definitionId, 'definitionId');

    const def = await pool.query(
        `select id from workflow_definitions where id = $1`,
        [definitionId]
    );
    if (def.rowCount === 0)
        throw Object.assign(new Error('WorkflowDefinitionNotFound'), { status: 404 });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const inst = await client.query(
            `insert into workflow_instances (workflow_definition_id, status, started_at)
       values ($1, 'running', now()) returning *`,
            [definitionId]
        );
        const instanceId = inst.rows[0].id as string;

        // all steps in this definition
        const steps = await client.query(
            `select id from workflow_steps where workflow_definition_id=$1`,
            [definitionId]
        );

        // inbound dependency count per step
        const inbound = await client.query(
            `select successor_step_id as step_id, count(*)::int as cnt
         from step_dependencies
        where successor_step_id in (select id from workflow_steps where workflow_definition_id=$1)
        group by successor_step_id`,
            [definitionId]
        );
        const inboundMap = new Map<string, number>(inbound.rows.map(r => [r.step_id, r.cnt]));

        // seed step_instances: steps with 0 inbound -> 'ready', else 'blocked'
        for (const s of steps.rows) {
            const status = (inboundMap.get(s.id) ?? 0) === 0 ? 'ready' : 'blocked';
            await client.query(
                `insert into step_instances (workflow_instance_id, step_id, status)
         values ($1, $2, $3)`,
                [instanceId, s.id, status]
            );
        }

        await client.query('COMMIT');
        return inst.rows[0];
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

export async function getProgress(instanceId: string) {
    assertUUID(instanceId, 'instanceId');

    const inst = await pool.query(
        `select * from workflow_instances where id=$1`,
        [instanceId]
    );
    if (inst.rowCount === 0)
        throw Object.assign(new Error('WorkflowInstanceNotFound'), { status: 404 });

    const steps = await pool.query(
        `select si.*, ws.name, ws.sequence, ws.type
       from step_instances si
       join workflow_steps ws on ws.id = si.step_id
      where si.workflow_instance_id = $1
      order by ws.sequence asc`,
        [instanceId]
    );

    return { instance: inst.rows[0], steps: steps.rows };
}

export async function advanceStep(instanceId: string, stepId: string) {
    assertUUID(instanceId, 'instanceId');
    assertUUID(stepId, 'stepId');

    const { rows, rowCount } = await pool.query(
        `update step_instances
        set status='in_progress',
            started_at=coalesce(started_at, now()),
            updated_at=now()
      where workflow_instance_id=$1 and step_id=$2 and status in ('ready','in_progress')
      returning *`,
        [instanceId, stepId]
    );
    if (!rowCount)
        throw Object.assign(new Error('StepInstanceNotAdvanceable'), { status: 400 });
    return rows[0];
}

export async function completeStep(instanceId: string, stepId: string) {
    assertUUID(instanceId, 'instanceId');
    assertUUID(stepId, 'stepId');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const upd = await client.query(
            `update step_instances
          set status='completed', completed_at=now(), updated_at=now()
        where workflow_instance_id=$1 and step_id=$2 and status in ('ready','in_progress')
        returning *`,
            [instanceId, stepId]
        );
        if (!upd.rowCount)
            throw Object.assign(new Error('StepInstanceNotCompletable'), { status: 400 });

        // Unblock dependents whose all predecessors are completed
        await client.query(
            `update step_instances si
          set status='ready', updated_at=now()
        where si.workflow_instance_id = $1
          and si.status = 'blocked'
          and si.step_id in (
            select d.successor_step_id
              from step_dependencies d
             where d.predecessor_step_id = $2
          )
          and not exists (
            select 1
              from step_dependencies d2
              join step_instances si2
                on si2.workflow_instance_id = si.workflow_instance_id
               and si2.step_id = d2.predecessor_step_id
             where d2.successor_step_id = si.step_id
               and si2.status <> 'completed'
          )`,
            [instanceId, stepId]
        );

        // If all steps completed -> mark instance completed
        const left = await client.query(
            `select 1 from step_instances where workflow_instance_id=$1 and status <> 'completed' limit 1`,
            [instanceId]
        );
        if (left.rowCount === 0) {
            await client.query(
                `update workflow_instances
            set status='completed', completed_at=now(), updated_at=now()
          where id=$1`,
                [instanceId]
            );
        }

        await client.query('COMMIT');
        return upd.rows[0];
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}
