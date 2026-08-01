import assert from 'node:assert/strict';
import test from 'node:test';
import { getStoreAvailability, getStoreConfig } from '../worker/config.js';
import { PRODUCT } from '../worker/product.js';

function environment() {
  const sha = 'b'.repeat(64);
  return {
    STORE_LIVE: 'true',
    SITE_URL: 'https://www.rtldatasets.com',
    STRIPE_SECRET_KEY: 'sk_test_example',
    STRIPE_WEBHOOK_SECRET: 'whsec_example',
    STRIPE_SAMPLE_PRICE_ID: 'price_example',
    STRIPE_AUTOMATIC_TAX: 'false',
    ENTITLEMENT_SIGNING_SECRET: 'a-signing-secret-that-is-more-than-32-bytes',
    SAMPLE_ARCHIVE_SHA256: sha,
    SAMPLE_R2_KEY: `artifacts/product/v1/sha256/${sha}/${PRODUCT.archiveFilename}`,
    SAMPLE_ARCHIVE_BYTES: '12345',
    FULFILLMENT_FROM_EMAIL: 'delivery@rtldatasets.com',
    ORDERS: {},
    PRODUCTS: {},
    EMAIL: {},
    CHECKOUT_RATE_LIMITER: {},
  };
}

test('a complete Cloudflare store configuration is available', () => {
  const env = environment();
  const config = getStoreConfig(env);
  assert.equal(config.archiveBytes, 12345);
  assert.equal(config.stripeLivemode, false);
  assert.deepEqual(getStoreAvailability(env), { available: true });
});

test('store live flag and missing bindings fail closed', () => {
  const env = environment();
  env.STORE_LIVE = 'false';
  assert.deepEqual(getStoreAvailability(env), { available: false });
  env.STORE_LIVE = 'true';
  delete env.PRODUCTS;
  assert.deepEqual(getStoreAvailability(env), { available: false });
});

test('artifact key must contain the exact content hash', () => {
  const env = environment();
  env.SAMPLE_R2_KEY = `artifacts/product/v1/sha256/${'c'.repeat(64)}/${PRODUCT.archiveFilename}`;
  assert.throws(() => getStoreConfig(env));
});
