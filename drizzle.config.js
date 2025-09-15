import { config } from "dotenv";

// Load environment variables
config({ path: "server/.env" });

export default {
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql", 
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
};
