// scripts/seed.neon.mjs - Fixed version
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables
config();

// Execution banner
console.log('🌱 [NEON SEED] Starting Pathfinder M1 seed process...');
console.log('📁 File: seed.neon.mjs');
console.log('🕒 Time:', new Date().toISOString());
console.log('⚙️  Node version:', process.version);
console.log('🔧 Args:', process.argv.slice(2));
if (process.env.PGSCHEMA) console.log('🏷️  Target schema override:', process.env.PGSCHEMA);
console.log('─'.repeat(60));

// Initialize Neon connection
const sql = neon(process.env.DATABASE_URL);

// Configuration
const isDryRun = process.argv.includes('--dry') || process.env.DRY_RUN === '1';

// Fixed UUIDs for deterministic seeding
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

// Utility functions
function ago(minutes) {
  return new Date(Date.now() - minutes * 60000).toISOString();
}

function isPg() {
  const url = String(process.env.DATABASE_URL || '');
  return url.indexOf('postgres') === 0;
}

async function run(label, fn) {
  try {
    await fn();
    console.log('✓', label);
  } catch (e) {
    console.error('✗', label);
    console.error(e?.message || e);
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

// Schema-aware column helper
function makeColIndex(names) {
  const byLower = new Map();
  for (let i = 0; i < names.length; i++) {
    const n = String(names[i]);
    byLower.set(n.toLowerCase(), n);
  }
  return {
    all: names,
    has: function(name) { return byLower.has(String(name).toLowerCase()); },
    pick: function() {
      for (let i = 0; i < arguments.length; i++) {
        const c = String(arguments[i]);
        const hit = byLower.get(c.toLowerCase());
        if (hit) return hit;
      }
      return null;
    }
  };
}

async function listCols(table) {
  const schema = process.env.PGSCHEMA || 'public';
  const res = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema=${schema} AND table_name=${table}
  `;
  const names = res.map(r => String(r.column_name));
  return makeColIndex(names);
}

// Insert workflow definitions (simplified version)
async function insertWorkflowDefinition(id, friendlyName) {
  if (isDryRun) {
    console.log('[dry] insert workflow_definitions', { id, friendlyName });
    return;
  }

  try {
    await sql`
      INSERT INTO workflow_definitions (id, name, status, version, created_at, updated_at)
      VALUES (${id}, ${friendlyName}, 'active', 1, ${ago(300)}, ${ago(10)})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = EXCLUDED.updated_at
    `;
  } catch (err) {
    // Fallback without ON CONFLICT
    const exists = await sql`SELECT 1 FROM workflow_definitions WHERE id = ${id} LIMIT 1`;
    if (exists.length === 0) {
      await sql`
        INSERT INTO workflow_definitions (id, name, status, version, created_at, updated_at)
        VALUES (${id}, ${friendlyName}, 'active', 1, ${ago(300)}, ${ago(10)})
      `;
    }
  }
}

// Insert workflow steps (simplified version)
async function insertWorkflowSteps() {
  const steps = [
    { id: IDs.sA1, wfDefId: IDs.wfDefOrder, sequence: 1, name: 'Created', type: 'task' },
    { id: IDs.sA2, wfDefId: IDs.wfDefOrder, sequence: 2, name: 'Packed', type: 'task' },
    { id: IDs.sA3, wfDefId: IDs.wfDefOrder, sequence: 3, name: 'Shipped', type: 'task' },
    { id: IDs.sA4, wfDefId: IDs.wfDefOrder, sequence: 4, name: 'Delivered', type: 'task' },
    { id: IDs.sB1, wfDefId: IDs.wfDefKyc, sequence: 1, name: 'Upload documents', type: 'task' },
    { id: IDs.sB2, wfDefId: IDs.wfDefKyc, sequence: 2, name: 'Live selfie', type: 'task' },
    { id: IDs.sB3, wfDefId: IDs.wfDefKyc, sequence: 3, name: 'Analyst review', type: 'approval' },
  ];

  for (const step of steps) {
    if (isDryRun) {
      console.log('[dry] insert workflow_steps', { id: step.id, name: step.name });
      continue;
    }

    try {
      await sql`
        INSERT INTO workflow_steps (id, workflow_definition_id, sequence, name, type, created_at, updated_at)
        VALUES (${step.id}, ${step.wfDefId}, ${step.sequence}, ${step.name}, ${step.type}, ${ago(300)}, ${ago(10)})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          updated_at = EXCLUDED.updated_at
      `;
    } catch (err) {
      const exists = await sql`SELECT 1 FROM workflow_steps WHERE id = ${step.id} LIMIT 1`;
      if (exists.length === 0) {
        await sql`
          INSERT INTO workflow_steps (id, workflow_definition_id, sequence, name, type, created_at, updated_at)
          VALUES (${step.id}, ${step.wfDefId}, ${step.sequence}, ${step.name}, ${step.type}, ${ago(300)}, ${ago(10)})
        `;
      }
    }
  }
}

// Insert workflow instances
async function insertWorkflowInstances() {
  const instances = [
    { id: IDs.wfAlpha, workflowDefinitionId: IDs.wfDefOrder, status: 'completed', createdAt: ago(240), updatedAt: ago(5) },
    { id: IDs.wfBeta, workflowDefinitionId: IDs.wfDefKyc, status: 'running', createdAt: ago(180), updatedAt: ago(15) },
  ];

  for (const instance of instances) {
    if (isDryRun) {
      console.log('[dry] insert workflow_instances', { id: instance.id, status: instance.status });
      continue;
    }

    try {
      await sql`
        INSERT INTO workflow_instances (id, workflow_definition_id, status, created_at, updated_at)
        VALUES (${instance.id}, ${instance.workflowDefinitionId}, ${instance.status}, ${instance.createdAt}, ${instance.updatedAt})
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at
      `;
    } catch (err) {
      const exists = await sql`SELECT 1 FROM workflow_instances WHERE id = ${instance.id} LIMIT 1`;
      if (exists.length === 0) {
        await sql`
          INSERT INTO workflow_instances (id, workflow_definition_id, status, created_at, updated_at)
          VALUES (${instance.id}, ${instance.workflowDefinitionId}, ${instance.status}, ${instance.createdAt}, ${instance.updatedAt})
        `;
      }
    }
  }
}

// Insert step instances
async function insertStepInstances() {
  const steps = [
    { id: IDs.sA1, wf: IDs.wfAlpha, stepId: IDs.sA1, status: 'completed', c: 240, s: 240, d: 200 },
    { id: IDs.sA2, wf: IDs.wfAlpha, stepId: IDs.sA2, status: 'completed', c: 200, s: 195, d: 150 },
    { id: IDs.sA3, wf: IDs.wfAlpha, stepId: IDs.sA3, status: 'completed', c: 150, s: 145, d: 60 },
    { id: IDs.sA4, wf: IDs.wfAlpha, stepId: IDs.sA4, status: 'completed', c: 60, s: 55, d: 5 },
    { id: IDs.sB1, wf: IDs.wfBeta, stepId: IDs.sB1, status: 'completed', c: 170, s: 170, d: 140 },
    { id: IDs.sB2, wf: IDs.wfBeta, stepId: IDs.sB2, status: 'failed', c: 170, s: 165, d: null },
    { id: IDs.sB3, wf: IDs.wfBeta, stepId: IDs.sB3, status: 'blocked', c: 140, s: null, d: null },
  ];

  for (const step of steps) {
    if (isDryRun) {
      console.log('[dry] insert step_instances', { id: step.id, status: step.status });
      continue;
    }

    const values = [step.id, step.wf, step.stepId, mapStepStatus(step.status), ago(step.c)];
    const fields = ['id', 'workflow_instance_id', 'step_id', 'status', 'created_at'];
    const placeholders = ['$1', '$2', '$3', '$4', '$5'];
    let paramCount = 5;

    if (step.s !== null) {
      fields.push('started_at');
      values.push(ago(step.s));
      placeholders.push(`$${++paramCount}`);
    }
    if (step.d !== null) {
      fields.push('completed_at');
      values.push(ago(step.d));
      placeholders.push(`$${++paramCount}`);
    }

    try {
      const query = `
        INSERT INTO step_instances (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          updated_at = NOW()
      `;
      await sql(query, values);
    } catch (err) {
      const exists = await sql`SELECT 1 FROM step_instances WHERE id = ${step.id} LIMIT 1`;
      if (exists.length === 0) {
        const insertQuery = `INSERT INTO step_instances (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
        await sql(insertQuery, values);
      }
    }
  }
}

// Insert step dependencies 
async function insertStepDependencies() {
  if (isDryRun) {
    console.log('[dry] insert step_dependencies');
    return;
  }

  const dependencies = [
    { from: IDs.sA1, to: IDs.sA2 },
    { from: IDs.sA2, to: IDs.sA3 },
    { from: IDs.sA3, to: IDs.sA4 },
    { from: IDs.sB1, to: IDs.sB3 },
    { from: IDs.sB2, to: IDs.sB3 },
  ];

  for (const dep of dependencies) {
    try {
      await sql`
        INSERT INTO step_dependencies (predecessor_step_id, successor_step_id, dependency_type, created_at)
        VALUES (${dep.from}, ${dep.to}, 'finish_to_start', ${ago(200)})
        ON CONFLICT (predecessor_step_id, successor_step_id) DO NOTHING
      `;
    } catch (err) {
      const exists = await sql`
        SELECT 1 FROM step_dependencies 
        WHERE predecessor_step_id = ${dep.from} AND successor_step_id = ${dep.to} 
        LIMIT 1
      `;
      if (exists.length === 0) {
        await sql`
          INSERT INTO step_dependencies (predecessor_step_id, successor_step_id, dependency_type, created_at)
          VALUES (${dep.from}, ${dep.to}, 'finish_to_start', ${ago(200)})
        `;
      }
    }
  }
}

// Truncate tables (simplified)
async function truncateAll() {
  if (isDryRun) {
    console.log('[dry] truncate step_dependencies, step_instances, workflow_instances');
    return;
  }
  
  const tables = ['step_dependencies', 'step_instances', 'workflow_instances'];
  
  console.log('🗑️  Truncating tables:', tables);
  
  for (const table of tables) {
    try {
      await sql(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      console.log(`✓ Truncated ${table}`);
    } catch (err) {
      console.log(`⚠️  Could not truncate ${table}:`, err.message);
    }
  }
}

// Main execution
async function main() {
  console.log(isDryRun ? '🔍 DRY RUN MODE - No data will be modified' : '🚀 EXECUTING SEED');
  
  await run('truncate tables', async () => {
    await truncateAll();
  });

  await run('ensure workflow_definitions: order', async () => {
    await insertWorkflowDefinition(IDs.wfDefOrder, 'Order Fulfillment');
  });

  await run('ensure workflow_definitions: kyc', async () => {
    await insertWorkflowDefinition(IDs.wfDefKyc, 'KYC Onboarding');
  });

  await run('insert workflow_steps', async () => {
    await insertWorkflowSteps();
  });

  await run('insert workflow_instances', async () => {
    await insertWorkflowInstances();
  });

  await run('insert step_instances', async () => {
    await insertStepInstances();
  });

  await run('insert step_dependencies', async () => {
    await insertStepDependencies();
  });

  console.log('─'.repeat(60));
  console.log(isDryRun ? '✅ Seed (dry run) complete.' : '✅ Seed complete.');
  console.log('🌱 Pathfinder M1 database seeded successfully!');
}

main().catch((e) => {
  console.error('💥 Seed failed:', e);
  process.exit(1);
});