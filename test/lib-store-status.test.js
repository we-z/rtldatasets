import assert from 'node:assert/strict';
import test from 'node:test';
import { storeStatus } from '../lib/handlers.js';
import { PRODUCT } from '../lib/product.js';

test('store status is lightweight and exposes no amount', async () => {
  const env = {
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
  };

  const response = await storeStatus(
    new Request('https://www.rtltasks.com/api/store-status'),
    env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    available: true,
    product: PRODUCT.name,
    artifactVersion: PRODUCT.artifactVersion,
    archiveFilename: PRODUCT.archiveFilename,
  });
});
