  import fs from 'fs';

  const schemaPath = 'shared/types/schema.ts';
  let content = fs.readFileSync(schemaPath, 'utf8');

  // Replace the sessions table definition with a simpler version without the index
  const oldPattern = /export const sessions = pgTable\([^;]+\);/s;
  const newDefinition = `export const sessions = pgTable("sessions", {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  });`;

  content = content.replace(oldPattern, newDefinition);

  fs.writeFileSync(schemaPath, content);
  console.log('✅ Fixed sessions table - removed problematic index');
  EOF

