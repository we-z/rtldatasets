import assert from 'node:assert/strict';
import test from 'node:test';
import { findRecoverablePurchase, recordPurchase } from '../worker/database.js';
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
    artifactSha256: 'a'.repeat(64),
    artifactAssetPath: `/__private/artifacts/sha256/${'a'.repeat(64)}/${PRODUCT.archiveFilename}`,
    archiveBytes: 69675,
    stripeLivemode: false,
  };

  await recordPurchase(env, paid, config, 1_785_542_500_000);

  assert.match(calls[0].sql, /artifact_asset_path/u);
  assert.match(calls[0].sql, /checkout_attempt_id/u);
  assert.match(calls[0].sql, /ON CONFLICT\(checkout_session_id\) DO UPDATE/u);
  assert.ok(calls[0].values.includes(config.artifactAssetPath));
  assert.ok(calls[0].values.includes(paid.session.client_reference_id));
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
