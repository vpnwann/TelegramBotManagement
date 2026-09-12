import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    "[db] WARNING: DATABASE_URL is not set. Set it in your .env file (Neon PostgreSQL connection string)."
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("[db] Unexpected error on idle client", err);
});

/**
 * Helper to run a parameterized query.
 * @param {string} text
 * @param {Array} params
 */
export const query = (text, params) => pool.query(text, params);

export default pool;
