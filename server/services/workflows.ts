// server/services/workflows.ts
import { pool } from '../db';
import { assertUUID, pick } from '../utils/validators';

// ---- Definitions
export async function listWorkflowDefs() {
    const { rows } = await pool.query(
        `select * from workflow_definitions order by name asc, version asc`
    );
    return rows;
}

export async function getWorkflowDef(defId: string) {
    assertUUID(defId, 'definitionId');

    const def = await pool.query(
        `select * from workflow_definitions where id = $1`,
        [defId]
    );
    if (def.rowCount === 0)
        throw Object.assign(new Error('WorkflowDefinitionNotFound'), { status: 404 });

    const steps = await pool.query(
        `select * from workflow_steps where workflow_definition_id = $1 order by sequence asc`,
        [defId]
    );
    const deps = await pool.query(
        `select * from step_dependencies
      where predecessor_step_id in (select id from workflow_steps where workflow_definition_id=$1)
         or successor_step_id   in (select id from workflow_steps where workflow_definition_id=$1)`,
        [defId]
    );

    return { def: def.rows[0], steps: steps.rows, deps: deps.rows };
}

export async function createWorkflowDef(body: any) {
    const payload = pick(body, ['name', 'description', 'version', 'status']);
    const { rows } = await pool.query(
        `insert into workflow_definitions (name, description, version, status)
     values (coalesce($1,''), $2, coalesce($3,1), coalesce($4,'draft'))
     returning *`,
        [payload.name, payload.description ?? null, payload.version ?? null, payload.status ?? null]
    );
    return rows[0];
}

export async function updateWorkflowDef(defId: string, body: any) {
    assertUUID(defId, 'definitionId');
    const payload = pick(body, ['name', 'description', 'version', 'status']);
    const sets: string[] = []; const vals: any[] = [];
    Object.entries(payload).forEach(([k, v], i) => { sets.push(`${k}=$${i + 1}`); vals.push(v); });
    if (!sets.length) return (await getWorkflowDef(defId)).def;
    vals.push(defId);
    const { rows, rowCount } = await pool.query(
        `update workflow_definitions set ${sets.join(', ')}, updated_at=now() where id=$${vals.length} returning *`,
        vals
    );
    if (!rowCount) throw Object.assign(new Error('WorkflowDefinitionNotFound'), { status: 404 });
    return rows[0];
}

export async function deleteWorkflowDef(defId: string) {
    assertUUID(defId, 'definitionId');
    const { rowCount } = await pool.query(
        `delete from workflow_definitions where id=$1`,
        [defId]
    );
    if (!rowCount) throw Object.assign(new Error('WorkflowDefinitionNotFound'), { status: 404 });
    return { ok: true };
}

// ---- Steps
export async function addStep(defId: string, body: any) {
    assertUUID(defId, 'definitionId');
    const { sequence, name, type, assignee, duration_minutes, properties } = body;
    const { rows } = await pool.query(
        `insert into workflow_steps
       (workflow_definition_id, sequence, name, type, assignee, duration_minutes, properties)
     values ($1,$2,$3,$4,$5,$6,$7)
     returning *`,
        [defId, sequence, name, type, assignee ?? null, duration_minutes ?? null, properties ?? null]
    );
    return rows[0];
}

export async function updateStep(stepId: string, body: any) {
    assertUUID(stepId, 'stepId');
    const payload = pick(body, ['sequence', 'name', 'type', 'assignee', 'duration_minutes', 'properties']);
    const sets: string[] = []; const vals: any[] = [];
    Object.entries(payload).forEach(([k, v], i) => { sets.push(`${k}=$${i + 1}`); vals.push(v); });
    if (!sets.length) throw Object.assign(new Error('NothingToUpdate'), { status: 400 });
    vals.push(stepId);
    const { rows, rowCount } = await pool.query(
        `update workflow_steps set ${sets.join(', ')}, updated_at=now() where id=$${vals.length} returning *`,
        vals
    );
    if (!rowCount) throw Object.assign(new Error('WorkflowStepNotFound'), { status: 404 });
    return rows[0];
}

export async function deleteStep(stepId: string) {
    assertUUID(stepId, 'stepId');
    const { rowCount } = await pool.query(
        `delete from workflow_steps where id=$1`,
        [stepId]
    );
    if (!rowCount) throw Object.assign(new Error('WorkflowStepNotFound'), { status: 404 });
    return { ok: true };
}

// ---- Dependencies
export async function addDependency(body: any) {
    const { predecessor_step_id, successor_step_id, dependency_type } = body;
    assertUUID(predecessor_step_id, 'predecessor_step_id');
    assertUUID(successor_step_id, 'successor_step_id');

    // ensure both steps belong to the same definition
    const { rows: defs } = await pool.query(
        `select s1.workflow_definition_id as a, s2.workflow_definition_id as b
       from workflow_steps s1, workflow_steps s2
      where s1.id=$1 and s2.id=$2`,
        [predecessor_step_id, successor_step_id]
    );
    if (!defs.length || defs[0].a !== defs[0].b)
        throw Object.assign(new Error('StepsMustBelongToSameDefinition'), { status: 400 });

    const { rows } = await pool.query(
        `insert into step_dependencies (predecessor_step_id, successor_step_id, dependency_type)
     values ($1,$2,coalesce($3,'finish_to_start'))
     on conflict (predecessor_step_id, successor_step_id) do nothing
     returning *`,
        [predecessor_step_id, successor_step_id, dependency_type ?? null]
    );
    return rows[0] ?? { ok: true, skipped: 'duplicate' };
}

export async function deleteDependency(edgeId: string) {
    assertUUID(edgeId, 'id');
    const { rowCount } = await pool.query(
        `delete from step_dependencies where id=$1`,
        [edgeId]
    );
    if (!rowCount) throw Object.assign(new Error('StepDependencyNotFound'), { status: 404 });
    return { ok: true };
}
