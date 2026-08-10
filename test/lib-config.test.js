import assert from 'node:assert/strict';
import test from 'node:test';
import { getStoreAvailability, getStoreConfig } from '../lib/config.js';
import { PRODUCT } from '../lib/product.js';

function environment() {
  return {
    STORE_LIVE: 'true',
    SITE_URL: 'https://www.rtltasks.com',
    STRIPE_SECRET_KEY: 'sk_test_example',
    STRIPE_MODE: 'test',
    STRIPE_WEBHOOK_SECRET: 'whsec_example',
    STRIPE_SAMPLE_PRICE_ID: 'price_example',
    STRIPE_AUTOMATIC_TAX: 'false',
    ENTITLEMENT_SIGNING_SECRET: 'a-signing-secret-that-is-more-than-32-bytes',
    SAMPLE_ARCHIVE_SHA256: PRODUCT.archiveSha256,
    SAMPLE_ASSET_PATH: PRODUCT.artifactAssetPath,
    SAMPLE_ARCHIVE_BYTES: String(PRODUCT.archiveBytes),
    BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_test_token',
    DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'token',
  };
}

test('a complete Vercel store configuration is available', () => {
  const env = environment();
  const config = getStoreConfig(env);
  assert.equal(config.archiveBytes, PRODUCT.archiveBytes);
  assert.equal(config.artifactSha256, PRODUCT.archiveSha256);
  assert.equal(config.artifactAssetPath, PRODUCT.artifactAssetPath);
  assert.equal(config.stripeLivemode, false);
  assert.deepEqual(getStoreAvailability(env), { available: true });
});

test('store live flag and missing environment fail closed', () => {
  const env = environment();
  env.STORE_LIVE = 'false';
  assert.deepEqual(getStoreAvailability(env), { available: false });
  env.STORE_LIVE = 'true';
  delete env.DATABASE_URL;
  assert.deepEqual(getStoreAvailability(env), { available: false });
});

test('a missing protected artifact Blob token fails closed', () => {
  const env = environment();
  delete env.BLOB_READ_WRITE_TOKEN;
  assert.deepEqual(getStoreAvailability(env), { available: false });
});

test('artifact path must be private and contain the exact content hash', () => {
  const env = environment();
  env.SAMPLE_ASSET_PATH = `/__private/artifacts/product/v1/sha256/${'c'.repeat(64)}/${PRODUCT.archiveFilename}`;
  assert.throws(() => getStoreConfig(env));

  env.SAMPLE_ASSET_PATH = `/public/artifacts/product/v1/sha256/${PRODUCT.archiveSha256}/${PRODUCT.archiveFilename}`;
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
