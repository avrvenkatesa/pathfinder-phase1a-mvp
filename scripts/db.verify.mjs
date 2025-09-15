// scripts/db.verify.mjs
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const fmt = (rows) => rows.map(r => JSON.stringify(r)).join('\n');

const main = async () => {
  const [defs, inst, status, deps] = await Promise.all([
    sql`select count(*)::int as count from workflow_definitions`,
    sql`select count(*)::int as count from workflow_instances`,
    sql`select status, count(*)::int as count from step_instances group by 1 order by 1`,
    sql`select count(*)::int as count from step_dependencies`,
  ]);

  console.log('defs:', defs[0].count);
  console.log('instances:', inst[0].count);
  console.log('stepStatus:\n' + fmt(status));
  console.log('deps:', deps[0].count);
};

main().catch((e) => { console.error(e); process.exit(1); });
