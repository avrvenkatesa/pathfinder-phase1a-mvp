// scripts/seed.ts
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../server/db';
import {
  workflowDefinitions,
  workflowInstances,
  stepInstances,
  stepDependencies,
} from '../server/db/schema';

/** Deterministic, valid UUIDs */
const IDs = {
  wfDefOrder: '99999999-9999-4999-8999-999999999901',
  wfDefKyc:   '99999999-9999-4999-8999-999999999902',
  wfAlpha: '11111111-1111-4111-8111-111111111111',
  wfBeta:  '22222222-2222-4222-8222-222222222222',
  sA1: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
  sA2: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002',
  sA3: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0003',
  sA4: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0004',
  sB1: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001',
  sB2: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002',
  sB3: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0003',
} as const;

const ago = (m: number) => new Date(Date.now() - m * 60_000);
const isPg = () => (process.env.DATABASE_URL ?? '').startsWith('postgres');
const isDryRun = process.argv.includes('--dry') || process.env.DRY_RUN === '1';

/** pretty runner so we stop at the FIRST real error (no 25P02 cascades) */
async function run(label: string, fn: () => Promise<any>) {
  try {
    await fn();
    console.log('✓', label);
  } catch (e: any) {
    console.error('✗', label);
    console.error(e?.message ?? e);
    throw e;
  }
}

/** enums mapping (from your enum dump) */
function mapStepStatus(s: string) {
  switch (s.toUpperCase()) {
    case 'PENDING': return 'pending';
    case 'READY': return 'ready';
    case 'RUNNING': return 'in_progress';
    case 'BLOCKED': return 'blocked';
    case 'COMPLETED': return 'completed';
    case 'CANCELLED': return 'cancelled';
    case 'FAILED': return 'failed';
    case 'SKIPPED': return 'skipped';
    default: return 'pending';
  }
}

/** --- Column utilities (case-insensitive, return actual column name) --- */
type ColIndex = { byLower: Map<string,string>, has:(name:string)=>boolean, pick:(...cands:string[])=>string|null };

function makeColIndex(names: string[]): ColIndex {
  const byLower = new Map<string,string>();
  for (const n of names) byLower.set(n.toLowerCase(), n);
  return {
    byLower,
    has: (name) => byLower.has(name.toLowerCase()),
    pick: (...cands: string[]) => {
      for (const c of cands) {
        const hit = byLower.get(c.toLowerCase());
        if (hit) return hit;
      }
      return null;
    }
  };
}

async function listCols(table: string): Promise<ColIndex> {
  // Works for Postgres. For SQLite, drizzle still exposes information_schema via compat.
  const res = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${table}
  `);
  const names = (res as any).rows.map((r: any) => r.column_name as string);
  return makeColIndex(names);
}

/** Upsert step definitions into whichever table the FK in step_instances points at. */
async function upsertStepDefinitions(
  stepDefsTable: string,
  defs: Array<{ id: string; wfDefId: string; key: string; name: string; position?: number }>
) {
  const cols = await listCols(stepDefsTable);

  const idCol   = cols.pick('id') ?? (() => { throw new Error(`${stepDefsTable}.id missing`); })();
  const wfCol   = cols.pick('workflow_definition_id','workflowDefinitionId','workflow_def_id')
                ?? (() => { throw new Error(`${stepDefsTable} needs workflow_definition_id`); })();
  const keyCol  = cols.pick('key','step_key','slug')
                ?? (() => { throw new Error(`${stepDefsTable} needs step key`); })();
  const nameCol = cols.pick('name','label')
                ?? (() => { throw new Error(`${stepDefsTable} needs name/label`); })();
  const posCol  = cols.pick('position');
  const cAt     = cols.pick('created_at','createdAt');
  const uAt     = cols.pick('updated_at','updatedAt');

  for (const d of defs) {
    const fields: string[] = [];
    const values: any[] = [];
    const add = (c: string | null, v: any) => { if (c) { fields.push(c); values.push(v); } };

    add(idCol, d.id);
    add(wfCol, d.wfDefId);
    add(keyCol, d.key);
    add(nameCol, d.name);
    add(posCol, d.position ?? null);
    add(cAt, ago(300));
    add(uAt, ago(10));

    const columnsSql = sql.join(fields.map(f => sql.identifier(f)), sql`, `);
    const valuesSql  = sql.join(values.map(v => sql`${v}`), sql`, `);

    if (isDryRun) { console.log('[dry] upsert', stepDefsTable, d); continue; }

    try {
      await db.execute(sql`
        INSERT INTO ${sql.identifier(stepDefsTable)} (${columnsSql})
        VALUES (${valuesSql})
        ON CONFLICT (${sql.identifier(idCol)}) DO UPDATE
        SET ${sql.identifier(nameCol)} = EXCLUDED.${sql.identifier(nameCol)}
          ${posCol ? sql.raw(`, ${posCol} = EXCLUDED.${posCol}`) : sql``}
          ${uAt ? sql.raw(`, ${uAt} = EXCLUDED.${uAt}`) : sql``}
      `);
    } catch {
      const exists = await db.execute(sql`
        SELECT 1 FROM ${sql.identifier(stepDefsTable)}
        WHERE ${sql.identifier(idCol)} = ${d.id} LIMIT 1
      `);
      if ((exists as any).rows?.length) {
        await db.execute(sql`
          UPDATE ${sql.identifier(stepDefsTable)}
          SET ${sql.identifier(nameCol)} = ${d.name}
              ${posCol ? sql.raw(`, ${posCol} = ${d.position ?? null}`) : sql``}
              ${uAt ? sql.raw(`, ${uAt} = ${ago(10)}`) : sql``}
          WHERE ${sql.identifier(idCol)} = ${d.id}
        `);
      } else {
        await db.execute(sql`
          INSERT INTO ${sql.identifier(stepDefsTable)} (${columnsSql})
          VALUES (${valuesSql})
        `);
      }
    }
  }
}

async function findStepDefRef() {
  const res = await db.execute(sql`
    SELECT kcu.column_name  AS from_column,
           ccu.table_name   AS to_table,
           ccu.column_name  AS to_column
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND kcu.table_name = 'step_instances'
      AND (LOWER(kcu.column_name) = 'step_id' OR LOWER(kcu.column_name) = 'stepid')
    LIMIT 1
  `);
  const r = (res as any).rows?.[0];
  if (!r) throw new Error('FK for step_instances.step_id not found.');
  return {
    stepIdColInInstances: r.from_column as string,
    stepDefsTable: r.to_table as string,
    stepDefsIdCol: r.to_column as string,
  };
}

async function truncateAll() {
  if (isDryRun) { console.log('[dry] truncate step_dependencies, step_instances, workflow_instances'); return; }
  if (isPg()) {
    await db.execute(sql`TRUNCATE TABLE ${stepDependencies} RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ${stepInstances} RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ${workflowInstances} RESTART IDENTITY CASCADE`);
  } else {
    await db.execute(sql`PRAGMA foreign_keys = OFF;`);
    await db.delete(stepDependencies);
    await db.delete(stepInstances);
    await db.delete(workflowInstances);
    await db.execute(sql`PRAGMA foreign_keys = ON;`);
  }
}

/** Insert a workflow definition using only columns that exist. */
async function insertWorkflowDefinition(id: string, friendlyName: string) {
  const cols = await listCols('workflow_definitions');

  const idCol   = cols.pick('id')!;
  const nameCol = cols.pick('name')!;
  const status  = cols.pick('status');
  const version = cols.pick('version');
  const cAt     = cols.pick('created_at','createdAt');
  const uAt     = cols.pick('updated_at','updatedAt');

  const fields: string[] = [];
  const values: any[] = [];
  const add = (c: string | null, v: any) => { if (c) { fields.push(c); values.push(v); } };

  add(idCol, id);
  add(nameCol, friendlyName);
  add(status, 'active');
  add(version, 1);
  add(cAt, ago(300)); add(uAt, ago(10));

  const columnsSql = sql.join(fields.map(f => sql.identifier(f)), sql`, `);
  const valuesSql  = sql.join(values.map(v => sql`${v}`), sql`, `);

  if (isDryRun) { console.log('[dry] insert workflow_definitions', { id, friendlyName }); return; }

  await db.execute(sql`
    INSERT INTO ${sql.identifier('workflow_definitions')} (${columnsSql})
    VALUES (${valuesSql})
    ON CONFLICT (${sql.identifier(idCol)}) DO NOTHING
  `);
}

/** Column-aware workflow instance insert */
async function insertWorkflowInstances() {
  const cols = await listCols('workflow_instances');

  const idCol  = cols.pick('id')!;
  const wfCol  = cols.pick('workflow_definition_id','workflowDefinitionId')!;
  const stat   = cols.pick('status');
  const name   = cols.pick('name','title','label');
  const ext1   = cols.pick('external_id','external_reference','reference');
  const cAt    = cols.pick('created_at','createdAt');
  const uAt    = cols.pick('updated_at','updatedAt');

  const buildRow = (params: {
    id: string;
    workflowDefinitionId: string;
    status: 'completed' | 'running';
    label: string;
    createdAt: Date;
    updatedAt: Date;
  }) => {
    const fields: string[] = [];
    const values: any[] = [];
    const add = (c: string | null, v: any) => { if (c) { fields.push(c); values.push(v); } };

    add(idCol, params.id);
    add(wfCol, params.workflowDefinitionId);
    add(stat, params.status);
    add(name, params.label);
    add(ext1, params.label);
    add(cAt, params.createdAt);
    add(uAt, params.updatedAt);
    return { fields, values };
  };

  const rows = [
    buildRow({ id: IDs.wfAlpha, workflowDefinitionId: IDs.wfDefOrder, status: 'completed', label: 'ORDER-1001', createdAt: ago(240), updatedAt: ago(5) }),
    buildRow({ id: IDs.wfBeta,  workflowDefinitionId: IDs.wfDefKyc,   status: 'running',   label: 'KYC-2001',   createdAt: ago(180), updatedAt: ago(15) }),
  ];

  for (const r of rows) {
    const columnsSql = sql.join(r.fields.map(f => sql.identifier(f)), sql`, `);
    const valuesSql  = sql.join(r.values.map(v => sql`${v}`), sql`, `);

    if (isDryRun) { console.log('[dry] insert workflow_instances', r.fields); continue; }

    await db.execute(sql`
      INSERT INTO ${sql.identifier('workflow_instances')} (${columnsSql})
      VALUES (${valuesSql})
      ON CONFLICT (${sql.identifier(idCol)}) DO NOTHING
    `);
  }
}

/** Column-aware insert for step_instances (snake vs camel, optional fields) */
async function insertStepInstances(stepIdColInInstances: string, steps: Array<{
  id: string; wf: string; def: string; status: string; pos: number;
  c: number; s: number | null; d: number | null; key: string; name: string;
}>) {
  const cols = await listCols('step_instances');

  const idCol   = cols.pick('id')!;
  const wfCol   = cols.pick('workflow_instance_id','workflowInstanceId')!;
  const fkCol   = stepIdColInInstances; // discovered actual name
  const keyCol  = cols.pick('step_key','key');
  const nameCol = cols.pick('name','label');
  const posCol  = cols.pick('position','sequence','order');
  const stat    = cols.pick('status','state');
  const cAt     = cols.pick('created_at','createdAt');
  const sAt     = cols.pick('started_at','startedAt');
  const dAt     = cols.pick('completed_at','completedAt');

  for (const s of steps) {
    const fields: string[] = [];
    const values: any[] = [];
    const add = (c: string | null, v: any) => { if (c) { fields.push(c); values.push(v); } };

    add(idCol, s.id);
    add(wfCol, s.wf);
    add(fkCol, s.def);
    add(keyCol, s.key);
    add(nameCol, s.name);
    add(posCol, s.pos);
    add(stat, mapStepStatus(s.status));
    if (cAt) add(cAt, ago(s.c));
    if (sAt && s.s != null) add(sAt, ago(s.s));
    if (dAt && s.d != null) add(dAt, ago(s.d));

    const columnsSql = sql.join(fields.map(f => sql.identifier(f)), sql`, `);
    const valuesSql  = sql.join(values.map(v => sql`${v}`), sql`, `);

    if (isDryRun) { console.log('[dry] insert step_instances', fields); continue; }

    await db.execute(sql`
      INSERT INTO ${sql.identifier('step_instances')} (${columnsSql})
      VALUES (${valuesSql})
      ON CONFLICT (${sql.identifier(idCol)}) DO NOTHING
    `);
  }
}

async function main() {
  await run('truncate', async () => { await truncateAll(); });

  await run('ensure workflow_definitions: order', async () => {
    await insertWorkflowDefinition(IDs.wfDefOrder, 'Order Fulfillment');
  });
  await run('ensure workflow_definitions: kyc', async () => {
    await insertWorkflowDefinition(IDs.wfDefKyc, 'KYC Onboarding');
  });

  const { stepIdColInInstances, stepDefsTable } = await (async () => {
    let ref!: { stepIdColInInstances: string; stepDefsTable: string; stepDefsIdCol: string };
    await run('discover step_def FK target', async () => {
      ref = await findStepDefRef();
    });
    return ref;
  })();

  await run(`upsert step definitions into ${stepDefsTable}`, async () => {
    await upsertStepDefinitions(stepDefsTable, [
      { id: IDs.sA1, wfDefId: IDs.wfDefOrder, key: 'created',   name: 'Created',           position: 1 },
      { id: IDs.sA2, wfDefId: IDs.wfDefOrder, key: 'packed',    name: 'Packed',            position: 2 },
      { id: IDs.sA3, wfDefId: IDs.wfDefOrder, key: 'shipped',   name: 'Shipped',           position: 3 },
      { id: IDs.sA4, wfDefId: IDs.wfDefOrder, key: 'delivered', name: 'Delivered',         position: 4 },
      { id: IDs.sB1, wfDefId: IDs.wfDefKyc,   key: 'document',  name: 'Upload documents',  position: 1 },
      { id: IDs.sB2, wfDefId: IDs.wfDefKyc,   key: 'selfie',    name: 'Live selfie',       position: 2 },
      { id: IDs.sB3, wfDefId: IDs.wfDefKyc,   key: 'review',    name: 'Analyst review',    position: 3 },
    ]);
  });

  await run('insert workflow_instances', async () => {
    await insertWorkflowInstances();
  });

  const steps = [
    { id: IDs.sA1, wf: IDs.wfAlpha, def: IDs.sA1, status: 'COMPLETED', pos: 1, c: 230, s: 230, d: 200, key:'created',   name:'Created' },
    { id: IDs.sA2, wf: IDs.wfAlpha, def: IDs.sA2, status: 'COMPLETED', pos: 2, c: 200, s: 195, d: 150, key:'packed',    name:'Packed' },
    { id: IDs.sA3, wf: IDs.wfAlpha, def: IDs.sA3, status: 'COMPLETED', pos: 3, c: 150, s: 145, d:  60, key:'shipped',   name:'Shipped' },
    { id: IDs.sA4, wf: IDs.wfAlpha, def: IDs.sA4, status: 'COMPLETED', pos: 4, c:  60, s:  55, d:   5, key:'delivered', name:'Delivered' },
    { id: IDs.sB1, wf: IDs.wfBeta,  def: IDs.sB1, status: 'COMPLETED', pos: 1, c: 170, s: 170, d: 140, key:'document',  name:'Upload documents' },
    { id: IDs.sB2, wf: IDs.wfBeta,  def: IDs.sB2, status: 'FAILED',    pos: 2, c: 170, s: 165, d: null, key:'selfie',    name:'Live selfie' },
    { id: IDs.sB3, wf: IDs.wfBeta,  def: IDs.sB3, status: 'BLOCKED',   pos: 3, c: 140, s: null, d: null, key:'review',   name:'Analyst review' },
  ] as const;

  await run('insert step_instances', async () => {
    await insertStepInstances(stepIdColInInstances, steps as any);
  });

  await run('insert step_dependencies', async () => {
    if (isDryRun) { console.log('[dry] insert step_dependencies'); return; }
    try {
      await db.execute(sql`
        INSERT INTO ${sql.identifier('step_dependencies')}
          (from_step_id, to_step_id, type)
        VALUES
          (${IDs.sA1}, ${IDs.sA2}, 'finish_to_start'),
          (${IDs.sA2}, ${IDs.sA3}, 'finish_to_start'),
          (${IDs.sA3}, ${IDs.sA4}, 'finish_to_start'),
          (${IDs.sB1}, ${IDs.sB3}, 'finish_to_start'),
          (${IDs.sB2}, ${IDs.sB3}, 'finish_to_start')
        ON CONFLICT DO NOTHING
      `);
    } catch {
      await db.execute(sql`
        INSERT INTO ${sql.identifier('step_dependencies')}
          (from_step_id, to_step_id)
        VALUES
          (${IDs.sA1}, ${IDs.sA2}),
          (${IDs.sA2}, ${IDs.sA3}),
          (${IDs.sA3}, ${IDs.sA4}),
          (${IDs.sB1}, ${IDs.sB3}),
          (${IDs.sB2}, ${IDs.sB3})
        ON CONFLICT DO NOTHING
      `);
    }
  });

  console.log(isDryRun ? 'Seed (dry run) complete.' : 'Seed complete.');
}

main().catch((e) => { console.error(e); process.exit(1); });
