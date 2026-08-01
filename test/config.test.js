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
    STRIPE_MODE: 'test',
    STRIPE_WEBHOOK_SECRET: 'whsec_example',
    STRIPE_SAMPLE_PRICE_ID: 'price_example',
    STRIPE_AUTOMATIC_TAX: 'false',
    ENTITLEMENT_SIGNING_SECRET: 'a-signing-secret-that-is-more-than-32-bytes',
    SAMPLE_ARCHIVE_SHA256: sha,
    SAMPLE_ASSET_PATH: `/__private/artifacts/product/v1/sha256/${sha}/${PRODUCT.archiveFilename}`,
    SAMPLE_ARCHIVE_BYTES: '12345',
    ORDERS: {},
    ASSETS: {},
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
  delete env.ASSETS;
  assert.deepEqual(getStoreAvailability(env), { available: false });
});

test('artifact path must be private and contain the exact content hash', () => {
  const env = environment();
  env.SAMPLE_ASSET_PATH = `/__private/artifacts/product/v1/sha256/${'c'.repeat(64)}/${PRODUCT.archiveFilename}`;
  assert.throws(() => getStoreConfig(env));

  env.SAMPLE_ASSET_PATH = `/public/artifacts/product/v1/sha256/${'b'.repeat(64)}/${PRODUCT.archiveFilename}`;
  assert.throws(() => getStoreConfig(env));
});

test('Stripe credentials must match the explicitly configured mode', () => {
  const env = environment();
  env.STRIPE_MODE = 'live';
  assert.throws(() => getStoreConfig(env), /Stripe key does not match STRIPE_MODE/u);

  env.STRIPE_SECRET_KEY = 'rk_live_example';
  assert.equal(getStoreConfig(env).stripeLivemode, true);

  env.STRIPE_MODE = 'production';
  assert.throws(() => getStoreConfig(env), /STRIPE_MODE must be live or test/u);
});
