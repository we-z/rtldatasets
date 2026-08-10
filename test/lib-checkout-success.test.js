import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutSuccess } from '../lib/handlers.js';
import { PRODUCT } from '../lib/product.js';

test('checkout completion is rate-limited before any Stripe lookup', async () => {
  let seenPrefix;
  let seenKey;
  const env = {
    SITE_URL: 'https://www.rtltasks.com',
    STRIPE_SECRET_KEY: 'sk_test_example',
    STRIPE_MODE: 'test',
    STRIPE_WEBHOOK_SECRET: 'whsec_example',
    STRIPE_SAMPLE_PRICE_ID: 'price_example',
    ENTITLEMENT_SIGNING_SECRET: 'a-signing-secret-that-is-more-than-32-bytes',
    SAMPLE_ARCHIVE_SHA256: PRODUCT.archiveSha256,
    SAMPLE_ASSET_PATH: PRODUCT.artifactAssetPath,
    SAMPLE_ARCHIVE_BYTES: String(PRODUCT.archiveBytes),
    UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'token',
    __rateLimitOverride: async (prefix, key) => {
      seenPrefix = prefix;
      seenKey = key;
      return { success: false };
    },
  };
  const request = new Request('https://www.rtltasks.com/api/checkout-success', {
    method: 'POST',
    headers: {
      Origin: 'https://www.rtltasks.com',
      'x-forwarded-for': '192.0.2.10',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ session_id: 'cs_test_1234567890abcdef' }),
  });

  await assert.rejects(
    checkoutSuccess(request, env),
    (error) => error.status === 429 && error.publicCode === 'completion_rate_limited',
  );
  assert.equal(seenPrefix, 'complete');
  assert.equal(seenKey, '192.0.2.10');
});
