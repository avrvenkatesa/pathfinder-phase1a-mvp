import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../server/db';

// List all enum types and labels
const ENUMS = sql`
  SELECT t.typname AS enum_type, e.enumlabel AS label
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
  ORDER BY t.typname, e.enumsortorder;
`;

// Optional: peek at table columns and types for your two tables (adjust names if needed)
const COLS = sql`
  SELECT c.table_name, c.column_name, c.data_type, c.udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name IN ('workflow_instances', 'step_instances')
  ORDER BY c.table_name, c.ordinal_position;
`;

async function main() {
  console.log('=== ENUMS ===');
  console.table(await db.execute(ENUMS));
  console.log('=== COLUMNS ===');
  console.table(await db.execute(COLS));
}
main().then(()=>process.exit(0)).catch(e => { console.error(e); process.exit(1); });
