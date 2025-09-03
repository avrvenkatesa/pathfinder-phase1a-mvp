// server/drizzle.config.ts
import type { Config } from "drizzle-kit";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as dotenv from "dotenv";

// Resolve server/.env relative to this config file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "./.env") });

export default {
  schema: "./db/schema.ts",       // your schema file
  out: "./drizzle",               // where SQL migrations will be written
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,   // pulled from server/.env
  },
  strict: true,
  verbose: true,
} satisfies Config;
