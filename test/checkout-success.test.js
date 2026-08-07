import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutSuccess } from '../worker/handlers.js';
import { PRODUCT } from '../worker/product.js';

test('checkout completion is rate-limited before any Stripe lookup', async () => {
  let rateKey;
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
    CHECKOUT_RATE_LIMITER: {
      async limit({ key }) {
        rateKey = key;
        return { success: false };
      },
    },
  };
  const request = new Request('https://www.rtltasks.com/api/checkout-success', {
    method: 'POST',
    headers: {
      Origin: 'https://www.rtltasks.com',
      'CF-Connecting-IP': '192.0.2.10',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ session_id: 'cs_test_1234567890abcdef' }),
  });

  await assert.rejects(
    checkoutSuccess(request, env),
    (error) => error.status === 429 && error.publicCode === 'completion_rate_limited',
  );
  assert.equal(rateKey, 'complete:192.0.2.10');
});
