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

// ---------------------------- Utilities ----------------------------
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
};

function ago(minutes) {
  return new Date(Date.now() - minutes * 60000);
}
function isPg() {
  var url = String(process.env.DATABASE_URL || '');
  return url.indexOf('postgres') === 0;
}
const isDryRun = process.argv.indexOf('--dry') !== -1 || process.env.DRY_RUN === '1';

async function run(label, fn) {
  try {
    await fn();
    console.log('✓', label);
  } catch (e) {
    console.error('✗', label);
    console.error(e && e.message ? e.message : e);
    throw e;
  }
}

function mapStepStatus(s) {
  switch (String(s || '').toUpperCase()) {
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

// Case-insensitive column helper; returns actual names from DB
function makeColIndex(names) {
  var byLower = new Map();
  for (var i = 0; i < names.length; i++) {
    var n = String(names[i]);
    byLower.set(n.toLowerCase(), n);
  }
  return {
    all: names,
    has: function(name) { return byLower.has(String(name).toLowerCase()); },
    pick: function() {
      for (var i = 0; i < arguments.length; i++) {
        var c = String(arguments[i]);
        var hit = byLower.get(c.toLowerCase());
        if (hit) return hit;
      }
      return null;
    }
  };
}

async function listCols(table) {
  const res = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${table}
  `);
  const rows = res && res.rows ? res.rows : [];
  const names = rows.map(function(r) { return String(r.column_name); });
  return makeColIndex(names);
}

// -------------------- Upsert Step Definitions (key optional) --------------------
async function upsertStepDefinitions(stepDefsTable, defs) {
  const cols = await listCols(stepDefsTable);

  const idCol = cols.pick('id');
  if (!idCol) throw new Error(stepDefsTable + '.id missing');

  const wfCol = cols.pick('workflow_definition_id','workflowDefinitionId','workflow_def_id');
  if (!wfCol) throw new Error(stepDefsTable + ' needs workflow_definition_id');

  // Optional key column — write only if it exists
  const keyCol = cols.pick(
    'key','step_key','slug','code','identifier',
    'step','step_code','stepId','step_name'
  );

  const nameCol = cols.pick('name','label');
  if (!nameCol) throw new Error(stepDefsTable + ' needs name/label');

  const posCol = cols.pick('position','sequence','order');
  const cAt = cols.pick('created_at','createdAt');
  const uAt = cols.pick('updated_at','updatedAt');

  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    const fields = [];
    const values = [];
    const used = new Set();
    const add = function(c, v) {
      if (c && !used.has(c)) {
        used.add(c);
        fields.push(c);
        values.push(v);
      }
    };

    add(idCol, d.id);
    add(wfCol, d.wfDefId);
    add(nameCol, d.name);
    add(keyCol, d.key);
    add(posCol, typeof d.position !== 'undefined' ? d.position : null);
    add(cAt, ago(300));
    add(uAt, ago(10));

    const columnsSql = sql.join(fields.map(function(f){ return sql.identifier(f); }), sql`, `);
    const valuesSql  = sql.join(values.map(function(v){ return sql`${v}`; }), sql`, `);

    if (isDryRun) {
      console.log('[dry] upsert', stepDefsTable, { id: d.id, name: d.name, keyWritten: !!keyCol });
      continue;
    }

    const setClauses = [ sql`${sql.identifier(nameCol)} = EXCLUDED.${sql.identifier(nameCol)}` ];
    if (posCol) setClauses.push(sql`${sql.identifier(posCol)} = EXCLUDED.${sql.identifier(posCol)}`);
    if (keyCol) setClauses.push(sql`${sql.identifier(keyCol)} = EXCLUDED.${sql.identifier(keyCol)}`);
    if (uAt)   setClauses.push(sql`${sql.identifier(uAt)}   = EXCLUDED.${sql.identifier(uAt)}`);

    try {
      await db.execute(sql`
        INSERT INTO ${sql.identifier(stepDefsTable)} (${columnsSql})
        VALUES (${valuesSql})
        ON CONFLICT (${sql.identifier(idCol)}) DO UPDATE
        SET ${sql.join(setClauses, sql`, `)}
      `);
    } catch (err) {
      // Fallback: update-if-exists, else insert
      const exists = await db.execute(sql`
        SELECT 1 FROM ${sql.identifier(stepDefsTable)}
        WHERE ${sql.identifier(idCol)} = ${d.id} LIMIT 1
      `);
      const hasRow = exists && exists.rows && exists.rows.length > 0;

      if (hasRow) {
        const updSets = [ sql`${sql.identifier(nameCol)} = ${d.name}` ];
        if (posCol) updSets.push(sql`${sql.identifier(posCol)} = ${typeof d.position !== 'undefined' ? d.position : null}`);
        if (keyCol) updSets.push(sql`${sql.identifier(keyCol)} = ${d.key}`);
        if (uAt)   updSets.push(sql`${sql.identifier(uAt)}   = ${ago(10)}`);

        await db.execute(sql`
          UPDATE ${sql.identifier(stepDefsTable)}
          SET ${sql.join(updSets, sql`, `)}
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

// ---------------- Discover FK from step_instances to step definitions -----------
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
  const rows = res && res.rows ? res.rows : [];
  const r = rows[0];
  if (!r) throw new Error('FK for step_instances.step_id not found.');
  return {
    stepIdColInInstances: String(r.from_column),
    stepDefsTable: String(r.to_table),
    stepDefsIdCol: String(r.to_column),
  };
}

// -------------------------------- Truncate -------------------------------------
async function truncateAll() {
  if (isDryRun) {
    console.log('[dry] truncate step_dependencies, step_instances, workflow_instances');
    return;
  }
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

// --------------------- Insert workflow_definitions (column-aware) ---------------
async function insertWorkflowDefinition(id, friendlyName) {
  const cols = await listCols('workflow_definitions');

  const idCol   = cols.pick('id');
  const nameCol = cols.pick('name');
  if (!idCol || !nameCol) throw new Error('workflow_definitions must have id, name');

  const status  = cols.pick('status');
  const version = cols.pick('version');
  const cAt     = cols.pick('created_at','createdAt');
  const uAt     = cols.pick('updated_at','updatedAt');

  const fields = [];
  const values = [];
  const used = new Set();
  const add = function(c, v) {
    if (c && !used.has(c)) { used.add(c); fields.push(c); values.push(v); }
  };

  add(idCol, id);
  add(nameCol, friendlyName);
  add(status, 'active');
  add(version, 1);
  add(cAt, ago(300));
  add(uAt, ago(10));

  const columnsSql = sql.join(fields.map(function(f){ return sql.identifier(f); }), sql`, `);
  const valuesSql  = sql.join(values.map(function(v){ return sql`${v}`; }), sql`, `);

  if (isDryRun) { console.log('[dry] insert workflow_definitions', { id: id, friendlyName: friendlyName }); return; }

  await db.execute(sql`
    INSERT INTO ${sql.identifier('workflow_definitions')} (${columnsSql})
    VALUES (${valuesSql})
    ON CONFLICT (${sql.identifier(idCol)}) DO NOTHING
  `);
}

// --------------------- Insert workflow_instances (column-aware) -----------------
async function insertWorkflowInstances() {
  const cols = await listCols('workflow_instances');

  const idCol = cols.pick('id');
  const wfCol = cols.pick('workflow_definition_id','workflowDefinitionId');
  if (!idCol || !wfCol) throw new Error('workflow_instances must have id, workflow_definition_id');

  const stat = cols.pick('status');
  const name = cols.pick('name','title','label');
  const ext1 = cols.pick('external_id','external_reference','reference','label','title');
  const cAt  = cols.pick('created_at','createdAt');
  const uAt  = cols.pick('updated_at','updatedAt');

  function buildRow(params) {
    const fields = [];
    const values = [];
    const used = new Set();
    const add = function(c, v) {
      if (c && !used.has(c)) { used.add(c); fields.push(c); values.push(v); }
    };

    add(idCol, params.id);
    add(wfCol, params.workflowDefinitionId);
    add(stat, params.status);
    add(name, params.label);
    if (ext1 && ext1 !== name) add(ext1, params.label);
    add(cAt, params.createdAt);
    add(uAt, params.updatedAt);
    return { fields: fields, values: values };
  }

  const rows = [
    buildRow({ id: IDs.wfAlpha, workflowDefinitionId: IDs.wfDefOrder, status: 'completed', label: 'ORDER-1001', createdAt: ago(240), updatedAt: ago(5) }),
    buildRow({ id: IDs.wfBeta,  workflowDefinitionId: IDs.wfDefKyc,   status: 'running',   label: 'KYC-2001',   createdAt: ago(180), updatedAt: ago(15) }),
  ];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const columnsSql = sql.join(r.fields.map(function(f){ return sql.identifier(f); }), sql`, `);
    const valuesSql  = sql.join(r.values.map(function(v){ return sql`${v}`; }), sql`, `);

    if (isDryRun) { console.log('[dry] insert workflow_instances', r.fields); continue; }

    await db.execute(sql`
      INSERT INTO ${sql.identifier('workflow_instances')} (${columnsSql})
      VALUES (${valuesSql})
      ON CONFLICT (${sql.identifier(idCol)}) DO NOTHING
    `);
  }
}

// --------------------- Insert step_instances (column-aware) ---------------------
async function insertStepInstances(stepIdColInInstances, steps) {
  const cols = await listCols('step_instances');

  const idCol = cols.pick('id');
  const wfCol = cols.pick('workflow_instance_id','workflowInstanceId');
  if (!idCol || !wfCol) throw new Error('step_instances must have id, workflow_instance_id');

  const fkCol  = stepIdColInInstances; // discovered actual name
  const keyCol = cols.pick('step_key','key');
  const nameCol= cols.pick('name','label');
  const posCol = cols.pick('position','sequence','order');
  const stat   = cols.pick('status','state');
  const cAt    = cols.pick('created_at','createdAt');
  const sAt    = cols.pick('started_at','startedAt');
  const dAt    = cols.pick('completed_at','completedAt');

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const fields = [];
    const values = [];
    const used = new Set();
    const add = function(c, v) {
      if (c && !used.has(c)) { used.add(c); fields.push(c); values.push(v); }
    };

    add(idCol, s.id);
    add(wfCol, s.wf);
    add(fkCol, s.def);
    add(keyCol, s.key);
    add(nameCol, s.name);
    add(posCol, s.pos);
    add(stat, mapStepStatus(s.status));
    if (cAt) add(cAt, ago(s.c));
    if (sAt && s.s !== null) add(sAt, ago(Number(s.s)));
    if (dAt && s.d !== null) add(dAt, ago(Number(s.d)));

    const columnsSql = sql.join(fields.map(function(f){ return sql.identifier(f); }), sql`, `);
    const valuesSql  = sql.join(values.map(function(v){ return sql`${v}`; }), sql`, `);

    if (isDryRun) { console.log('[dry] insert step_instances', fields); continue; }

    await db.execute(sql`
      INSERT INTO ${sql.identifier('step_instances')} (${columnsSql})
      VALUES (${valuesSql})
      ON CONFLICT (${sql.identifier(idCol)}) DO NOTHING
    `);
  }
}

// ----------------------------------- Main --------------------------------------
async function main() {
  await run('truncate', async function() { await truncateAll(); });

  await run('ensure workflow_definitions: order', async function() {
    await insertWorkflowDefinition(IDs.wfDefOrder, 'Order Fulfillment');
  });
  await run('ensure workflow_definitions: kyc', async function() {
    await insertWorkflowDefinition(IDs.wfDefKyc, 'KYC Onboarding');
  });

  const ref = await (async function() {
    let x = null;
    await run('discover step_def FK target', async function() {
      x = await findStepDefRef();
    });
    return x;
  })();

  await run('upsert step definitions into ' + ref.stepDefsTable, async function() {
    await upsertStepDefinitions(ref.stepDefsTable, [
      { id: IDs.sA1, wfDefId: IDs.wfDefOrder, key: 'created',   name: 'Created',           position: 1 },
      { id: IDs.sA2, wfDefId: IDs.wfDefOrder, key: 'packed',    name: 'Packed',            position: 2 },
      { id: IDs.sA3, wfDefId: IDs.wfDefOrder, key: 'shipped',   name: 'Shipped',           position: 3 },
      { id: IDs.sA4, wfDefId: IDs.wfDefOrder, key: 'delivered', name: 'Delivered',         position: 4 },
      { id: IDs.sB1, wfDefId: IDs.wfDefKyc,   key: 'document',  name: 'Upload documents',  position: 1 },
      { id: IDs.sB2, wfDefId: IDs.wfDefKyc,   key: 'selfie',    name: 'Live selfie',       position: 2 },
      { id: IDs.sB3, wfDefId: IDs.wfDefKyc,   key: 'review',    name: 'Analyst review',    position: 3 },
    ]);
  });

  await run('insert workflow_instances', async function() {
    await insertWorkflowInstances();
  });

  const steps = [
    { id: IDs.sA1, wf: IDs.wfAlpha, def: IDs.sA1, status: 'COMPLETED', pos: 1, c: 230, s: 230, d: 200, key: 'created',   name: 'Created' },
    { id: IDs.sA2, wf: IDs.wfAlpha, def: IDs.sA2, status: 'COMPLETED', pos: 2, c: 200, s: 195, d: 150, key: 'packed',    name: 'Packed' },
    { id: IDs.sA3, wf: IDs.wfAlpha, def: IDs.sA3, status: 'COMPLETED', pos: 3, c: 150, s: 145, d:  60, key: 'shipped',   name: 'Shipped' },
    { id: IDs.sA4, wf: IDs.wfAlpha, def: IDs.sA4, status: 'COMPLETED', pos: 4, c:  60, s:  55, d:   5, key: 'delivered', name: 'Delivered' },
    { id: IDs.sB1, wf: IDs.wfBeta,  def: IDs.sB1, status: 'COMPLETED', pos: 1, c: 170, s: 170, d: 140, key: 'document',  name: 'Upload documents' },
    { id: IDs.sB2, wf: IDs.wfBeta,  def: IDs.sB2, status: 'FAILED',    pos: 2, c: 170, s: 165, d: null, key: 'selfie',    name: 'Live selfie' },
    { id: IDs.sB3, wf: IDs.wfBeta,  def: IDs.sB3, status: 'BLOCKED',   pos: 3, c: 140, s: null, d: null, key: 'review',   name: 'Analyst review' },
  ];

  await run('insert step_instances', async function() {
    await insertStepInstances(ref.stepIdColInInstances, steps);
  });

  await run('insert step_dependencies', async function() {
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
    } catch (err) {
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

main().catch(function(e) {
  console.error(e);
  process.exit(1);
});
