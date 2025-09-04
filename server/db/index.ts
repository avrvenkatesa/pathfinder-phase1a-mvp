// server/db/index.ts
import 'dotenv/config';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) throw new Error('DATABASE_URL missing in server/.env');

export const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Neon requires SSL
});
