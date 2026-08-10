import { execFileSync } from 'node:child_process';
import pg from 'pg';

// One-time data migration: pulls every row out of the live Cloudflare D1
// `fulfillments` table (read-only against Cloudflare, safe to run any
// number of times) and upserts it into the new Postgres database so
// existing customers can still recover purchases / redownload after the
// cutover to Vercel.
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Set DATABASE_URL before running this script.');

  const d1Database = process.argv[2] || 'rtldatasets-orders';
  const raw = execFileSync('npx', [
    'wrangler', 'd1', 'execute', d1Database, '--remote', '--json',
    '--command', 'SELECT * FROM fulfillments',
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  const parsed = JSON.parse(raw);
  const rows = parsed[0]?.results || [];
  console.log(`Fetched ${rows.length} row(s) from D1 table "${d1Database}".`);

  const pool = new pg.Pool({ connectionString });
  try {
    let migrated = 0;
    for (const row of rows) {
      await pool.query(`
        INSERT INTO fulfillments (
          checkout_session_id, checkout_attempt_id, payment_intent_id, charge_id, customer_email,
          product_id, sku, artifact_version, artifact_sha256, artifact_asset_path,
          archive_bytes, terms_version, currency, amount_subtotal, amount_total,
          livemode, delivery_lease_id, redeem_expires_at, download_count,
          first_download_at, last_download_at, stripe_created_at, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
        ON CONFLICT (checkout_session_id) DO NOTHING
      `, [
        row.checkout_session_id,
        row.checkout_attempt_id,
        row.payment_intent_id,
        row.charge_id,
        row.customer_email,
        row.product_id,
        row.sku,
        row.artifact_version,
        row.artifact_sha256,
        row.artifact_asset_path,
        row.archive_bytes,
        row.terms_version,
        row.currency,
        row.amount_subtotal,
        row.amount_total,
        Boolean(row.livemode),
        row.delivery_lease_id ?? null,
        row.redeem_expires_at,
        row.download_count ?? 0,
        row.first_download_at ?? null,
        row.last_download_at ?? null,
        row.stripe_created_at,
        row.created_at,
        row.updated_at,
      ]);
      migrated += 1;
    }
    console.log(`Upserted ${migrated} row(s) into Postgres.`);

    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*)::int AS count FROM fulfillments');
    console.log(`Postgres "fulfillments" now has ${count} row(s) total.`);
    if (Number(count) < rows.length) {
      console.warn('Postgres has fewer rows than the D1 export — investigate before decommissioning D1.');
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
