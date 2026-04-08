import "./load-env";
import { Pool } from "pg";

/** Postgres local normalmente sem SSL; Railway/cloud quase sempre exige SSL, inclusive em dev local. */
function poolSsl():
  | false
  | {
      rejectUnauthorized: boolean;
    } {
  if (process.env.DATABASE_SSL === "false" || process.env.PGSSLMODE === "disable") {
    return false;
  }
  const u = process.env.DATABASE_URL || "";
  if (/localhost|127\.0\.0\.1/i.test(u)) {
    return false;
  }
  if (process.env.NODE_ENV === "production") {
    return { rejectUnauthorized: false };
  }
  if (/railway|neon\.tech|supabase|sslmode=require/i.test(u)) {
    return { rejectUnauthorized: false };
  }
  return false;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: poolSsl(),
});

export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}
