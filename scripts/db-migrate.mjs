import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations-pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Set DATABASE_URL before running db-migrate.');
  }

  const pool = new pg.Pool({ connectionString });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    for (const filename of files) {
      const { rows } = await pool.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [filename],
      );
      if (rows.length > 0) {
        console.log(`skip  ${filename} (already applied)`);
        continue;
      }
      const sql = await readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        console.log(`apply ${filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${filename} failed: ${error.message}`);
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
