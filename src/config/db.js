
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
  max: 5,                       // Neon's pooled endpoint handles fewer, shorter-lived connections better
  idleTimeoutMillis: 10000,     // release idle clients before Neon can silently drop them
  connectionTimeoutMillis: 8000 // fail fast with a real error instead of hanging
});

pool.on("error", (err) => {
  console.error("[db] Unexpected error on idle client", err);
});

/**
 * Helper to run a parameterized query, with one retry on transient
 * connection errors (e.g. Neon closing an idle pooled connection).
 */
export async function query(text, params, _retried = false) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    const transient =
      err.code === "ECONNRESET" ||
      err.code === "57P01" || // admin_shutdown
      /Connection terminated/i.test(err.message || "");

    if (transient && !_retried) {
      console.warn("[db] transient connection error, retrying once:", err.code || err.message);
      return query(text, params, true);
    }
    throw err;
  }
}

export default pool;

