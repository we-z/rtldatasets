import pg from 'pg';

const pools = new Map();

// Vercel functions can be reused across invocations on the same instance, so
// caching the pool per DATABASE_URL avoids opening a fresh connection (or
// pool) on every request while still working correctly in short-lived
// serverless environments and in tests where env.DATABASE_URL may differ.
export function getPool(env) {
  // Test-only seam: production never sets this, so it always exercises the
  // real Postgres pool below.
  if (env.__dbPoolOverride) return env.__dbPoolOverride;

  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL');
  }
  let pool = pools.get(connectionString);
  if (!pool) {
    pool = new pg.Pool({
      connectionString,
      ssl: connectionString.includes('sslmode=disable') ? false : { rejectUnauthorized: true },
      max: 5,
    });
    pools.set(connectionString, pool);
  }
  return pool;
}
