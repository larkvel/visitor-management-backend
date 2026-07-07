import pg from "pg";
import { config } from "../config.js";

console.log('[DB] Creating PostgreSQL connection pool...');

export const pool = new pg.Pool({
  connectionString: config.databaseUrl
});

// Log connection events
pool.on('connect', () => {
  console.log('[DB] ✓ New connection established');
});

pool.on('error', (err) => {
  console.error('[DB] ✗ Unexpected error on idle client:', err.message);
});

// Test initial connection (non-blocking)
pool.connect((err, client, release) => {
  if (err) {
    console.error('[DB] ✗ Failed to connect to database:', err.message);
  } else {
    console.log('[DB] ✓ Successfully connected to database');
    release();
  }
});

export async function query(text, params) {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('[DB] Query error:', error.message);
    throw error;
  }
}
