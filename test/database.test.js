import assert from 'node:assert/strict';
import test from 'node:test';
import { findRecoverablePurchase, recordDownload, recordPurchase } from '../worker/database.js';
import { PRODUCT } from '../worker/product.js';

test('purchase records use the protected asset path and remain idempotent', async () => {
  const calls = [];
  const env = {
    ORDERS: {
      prepare(sql) {
        return {
          bind(...values) {
            calls.push({ sql, values });
            return {
              run: async () => ({ meta: { changes: 1 } }),
              first: async () => ({ checkout_session_id: 'cs_test_example' }),
            };
          },
        };
      },
    },
  };
  const paid = {
    session: {
      id: 'cs_test_example',
      created: 1_785_542_400,
      client_reference_id: '123e4567-e89b-42d3-a456-426614174000',
      amount_total: PRODUCT.priceCents,
    },
    charge: { created: 1_785_542_410 },
    paymentIntentId: 'pi_test_example',
    chargeId: 'ch_test_example',
    customerEmail: 'buyer@example.com',
  };
  const config = {
    artifactSha256: PRODUCT.archiveSha256,
    artifactAssetPath: PRODUCT.artifactAssetPath,
    archiveBytes: PRODUCT.archiveBytes,
    stripeLivemode: false,
  };

  await recordPurchase(env, paid, config, 1_785_542_500_000);

  assert.match(calls[0].sql, /artifact_asset_path/u);
  assert.match(calls[0].sql, /checkout_attempt_id/u);
  assert.match(calls[0].sql, /ON CONFLICT\(checkout_session_id\) DO UPDATE/u);
  assert.match(calls[0].sql, /artifact_sha256 = excluded\.artifact_sha256/u);
  assert.match(calls[0].sql, /terms_version = excluded\.terms_version/u);
  assert.ok(calls[0].values.includes(config.artifactAssetPath));
  assert.ok(calls[0].values.includes(paid.session.client_reference_id));
});

test('delivery timestamp is written synchronously and fails closed without one row', async () => {
  const calls = [];
  const environment = (changes) => ({
    ORDERS: {
      prepare(sql) {
        return {
          bind(...values) {
            calls.push({ sql, values });
            return { run: async () => ({ meta: { changes } }) };
          },
        };
      },
    },
  });
  const timestamp = await recordDownload(
    environment(1),
    'cs_test_example',
    1_785_542_600_000,
  );
  assert.equal(timestamp, '2026-08-01T00:03:20.000Z');
  assert.match(calls[0].sql, /first_download_at = COALESCE\(first_download_at, \?\)/u);
  assert.equal(calls[0].values.at(-1), 'cs_test_example');
  await assert.rejects(
    () => recordDownload(environment(0), 'cs_test_missing', 1_785_542_600_000),
    (error) => error?.status === 503 && error?.publicCode === 'delivery_record_unavailable',
  );
});

test('recovery lookup is bounded by product, mode, trusted time, and remembered attempts', async () => {
  const calls = [];
  const row = {
    checkout_session_id: 'cs_test_recovery123456',
    checkout_attempt_id: '00000000-0000-4000-8000-000000000000',
  };
  const env = {
    ORDERS: {
      prepare(sql) {
        return {
          bind(...values) {
            calls.push({ sql, values });
            return { first: async () => row };
          },
        };
      },
    },
  };
  const attempts = Array.from({ length: 20 }, (_, index) =>
    `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`);
  const result = await findRecoverablePurchase(env, attempts, false, 1_800_000_000_000);

  assert.equal(result, row);
  assert.match(calls[0].sql, /checkout_attempt_id IN \(/u);
  assert.match(calls[0].sql, /stripe_created_at >= \?/u);
  assert.match(calls[0].sql, /ORDER BY stripe_created_at DESC/u);
  assert.match(calls[0].sql, /LIMIT 1/u);
  assert.equal(calls[0].values[0], PRODUCT.sku);
  assert.equal(calls[0].values[1], 0);
  assert.equal(calls[0].values.length, 23);
  assert.deepEqual(calls[0].values.slice(3), attempts);
});
