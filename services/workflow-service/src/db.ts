import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../../shared/types/schema";

// Database connection
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://user:password@localhost:5432/pathfinder";

const client = postgres(connectionString, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

// Test database connection
client`SELECT 1`
  .then(() => {
    console.log("✅ Workflow Service connected to database");
  })
  .catch((err) => {
    console.error("❌ Workflow Service database connection failed:", err);
    process.exit(1);
  });
