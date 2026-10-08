import pg from 'pg';
import { config } from '../config.js';
import { AppError } from '../utils/AppError.js';

// Direct Postgres connection to Supabase. `pg` does not name its prepared
// statements, so this is safe through PgBouncer in transaction mode (port 6543),
// which is what serverless deployments should use.
//
// The connection string may be a pooler URI or a plain localhost Postgres during
// development; SSL is enabled only for non-local hosts.

let pool;

const isLocal = (host) => host === 'localhost' || host === '127.0.0.1' || host === '::1';

function buildPool() {
  const url = config.supabase.dbUrl;
  if (!url) throw new AppError('SUPABASE_DB_URL is not set', 500);

  let local = false;
  try {
    local = isLocal(new URL(url).hostname);
  } catch {
    local = false;
  }

  return new pg.Pool({
    connectionString: url,
    max: Number(process.env.SUPABASE_POOL_MAX) || 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: config.supabase.timeoutMs,
    // Supabase presents a certificate that is not in Node's default store.
    ssl: local ? false : { rejectUnauthorized: false },
  });
}

export function getPool() {
  if (!pool) {
    pool = buildPool();
    // A dropped idle connection must not crash the process.
    pool.on('error', (err) => console.error('[supabase] idle client error:', err.message));
  }
  return pool;
}

export async function query(text, params = []) {
  try {
    return await getPool().query(text, params);
  } catch (err) {
    if (err?.code === '23505') throw new AppError('That value is already taken', 400);
    if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET'].includes(err?.code)) {
      throw new AppError('Could not reach the database. Please try again.', 503);
    }
    throw err;
  }
}

export async function closePool() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = undefined;
  }
}
