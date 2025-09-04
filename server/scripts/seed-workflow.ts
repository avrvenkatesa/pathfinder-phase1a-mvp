// server/scripts/seed-workflow.ts
import "dotenv/config";
import { eq } from "drizzle-orm";

// Prefer using your existing db singleton if you have one:
let db: any;
try {
  // Try to import db.ts or db.js which should export `db`
  const mod = await import("../db.js").catch(() => import("../db.ts"));
  db = mod.db;
} catch (e) {
  // Fallback: construct a fresh Neon + Drizzle client
  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const schema = await import("../db/schema.js").catch(() => import("../db/schema.ts"));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
}

const {
  workflowDefinitions,
  workflowSteps,
  stepDependencies,
} = await import("../db/schema.js").catch(() => import("../db/schema.ts"));

async function main() {
  const name = "Onboarding";
  const version = 1;

  // Upsert workflow definition
  const existing = await db
    .select()
    .from(workflowDefinitions)
    .where(eq(workflowDefinitions.name, name));

  let def = existing.find((d: any) => d.version === version);
  if (!def) {
    [def] = await db
      .insert(workflowDefinitions)
      .values({
        name,
        version,
        status: "active",
        description: "Simple 3-step sequential onboarding",
      })
      .returning();
    console.log("Created definition:", def.id);
  } else {
    console.log("Definition already exists:", def.id);
  }

  // Insert 3 steps
  const [s1] = await db.insert(workflowSteps).values({
    workflowDefinitionId: def.id,
    sequence: 1,
    name: "Fill Profile",
    type: "task",
    durationMinutes: 10,
  }).onConflictDoNothing().returning();

  const [s2] = await db.insert(workflowSteps).values({
    workflowDefinitionId: def.id,
    sequence: 2,
    name: "Manager Approval",
    type: "approval",
    durationMinutes: 5,
  }).onConflictDoNothing().returning();

  const [s3] = await db.insert(workflowSteps).values({
    workflowDefinitionId: def.id,
    sequence: 3,
    name: "Send Welcome Email",
    type: "notification",
    durationMinutes: 1,
  }).onConflictDoNothing().returning();

  // Fetch steps (needed if they already existed)
  const steps = await db.select().from(workflowSteps)
    .where(eq(workflowSteps.workflowDefinitionId, def.id));

  const stepBySeq = (seq: number) => steps.find((r: any) => r.sequence === seq);
  const step1 = s1 ?? stepBySeq(1);
  const step2 = s2 ?? stepBySeq(2);
  const step3 = s3 ?? stepBySeq(3);

  // Create dependencies: 1 -> 2, 2 -> 3
  if (step1 && step2) {
    await db.insert(stepDependencies).values({
      predecessorStepId: step1.id,
      successorStepId: step2.id,
      dependencyType: 'finish_to_start',
    }).onConflictDoNothing();
  }
  if (step2 && step3) {
    await db.insert(stepDependencies).values({
      predecessorStepId: step2.id,
      successorStepId: step3.id,
      dependencyType: 'finish_to_start',
    }).onConflictDoNothing();
  }

  console.log("Seed complete ✅");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
