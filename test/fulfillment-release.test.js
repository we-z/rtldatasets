import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { artifactDownloadHeaders } from '../worker/handlers.js';
import { LEGACY_CHECKOUT_ARTIFACTS, PRODUCT } from '../worker/product.js';

const RELEASE = Object.freeze({
  artifactVersion: '2.0.0',
  packageId: 'soc-dv-gpt-5.6-luna-customer-package-v1',
  archiveFilename: 'soc-dv-gpt-5.6-luna-customer-package-v2.0.0.zip',
  archiveContentType: 'application/zip',
  archiveSha256: '99ea9ecffc4f9e9d5d456b14510d6976c36b6e8be31ce246a8ee025c21d2b0bc',
  archiveBytes: 154_827,
  artifactAssetPath: '/__private/artifacts/soc-dv-rlvr-diagnostic-sample-5-task/v2.0.0/sha256/99ea9ecffc4f9e9d5d456b14510d6976c36b6e8be31ce246a8ee025c21d2b0bc/soc-dv-gpt-5.6-luna-customer-package-v2.0.0.zip',
  termsVersion: '1.1.0',
  termsSha256: 'ed1d379b4c9d94aa5aa1ad40a7be813bb30be3567c5404170a455eabcd95f795',
  orderBindingVersion: '1.0.1',
  orderBindingSha256: '868f52938aaca2f4a97173479bae1cde576e4aca694f4966e74abef3458698b0',
});

test('product constants pin the exact v2.0.0 Diagnostic Sample release', () => {
  assert.equal(PRODUCT.name, 'SoC Design + Verification RLVR Diagnostic Sample: 5 Tasks');
  for (const [key, value] of Object.entries(RELEASE)) {
    assert.equal(PRODUCT[key], value, `${key} must match the customer release`);
  }
  assert.equal(PRODUCT.priceCents, 100_000);
  assert.equal(PRODUCT.currency, 'usd');
  assert.equal(PRODUCT.acceptanceMethod, 'web_checkbox_post_v1');
});

test('production configuration alone pins and uploads the exact immutable release', async () => {
  const config = JSON.parse(
    await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
  );
  assert.equal(config.assets.directory, './.worker-assets');
  assert.equal(config.assets.run_worker_first, true);
  assert.equal(config.vars.SAMPLE_ASSET_PATH, RELEASE.artifactAssetPath);
  assert.equal(config.vars.SAMPLE_ARCHIVE_SHA256, RELEASE.archiveSha256);
  assert.equal(config.vars.SAMPLE_ARCHIVE_BYTES, String(RELEASE.archiveBytes));
  assert.deepEqual(config.routes, [
    { pattern: 'www.rtldatasets.com', custom_domain: true },
    { pattern: 'www.rtltasks.com', custom_domain: true },
    { pattern: 'rtltasks.com', custom_domain: true },
    { pattern: 'puul.ai/*', zone_name: 'puul.ai' },
    { pattern: 'www.puul.ai/*', zone_name: 'puul.ai' },
  ]);
});

test('public Stripe-test sandbox is disabled and cannot upload the paid archive', async () => {
  const [config, packageJson] = await Promise.all([
    readFile(new URL('../wrangler.sandbox.jsonc', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  assert.equal(config.workers_dev, true);
  assert.equal(config.assets.directory, './public');
  assert.equal(config.vars.STORE_LIVE, 'false');
  assert.equal(config.vars.STRIPE_MODE, 'test');
  assert.equal(config.vars.SAMPLE_ASSET_PATH, undefined);
  assert.equal(config.vars.SAMPLE_ARCHIVE_SHA256, undefined);
  assert.equal(config.vars.SAMPLE_ARCHIVE_BYTES, undefined);
  assert.doesNotMatch(packageJson.scripts['deploy:sandbox'], /verify:worker-assets/u);
});

test('staging remains public-only and cannot enable paid fulfillment', async () => {
  const config = JSON.parse(
    await readFile(new URL('../wrangler.staging.jsonc', import.meta.url), 'utf8'),
  );
  assert.equal(config.assets.directory, './public');
  assert.equal(config.vars.STORE_LIVE, 'false');
  assert.equal(config.vars.SAMPLE_ASSET_PATH, undefined);
  assert.equal(config.vars.SAMPLE_ARCHIVE_SHA256, undefined);
  assert.equal(config.vars.SAMPLE_ARCHIVE_BYTES, undefined);
});

test('download response headers identify the exact ZIP and its digest', () => {
  const headers = artifactDownloadHeaders({
    archiveBytes: RELEASE.archiveBytes,
    artifactSha256: RELEASE.archiveSha256,
  }, new Response(null, { headers: { ETag: '"release-etag"' } }));

  assert.equal(headers.get('Content-Type'), RELEASE.archiveContentType);
  assert.equal(
    headers.get('Content-Disposition'),
    `attachment; filename="${RELEASE.archiveFilename}"`,
  );
  assert.equal(headers.get('Content-Length'), String(RELEASE.archiveBytes));
  assert.equal(headers.get('X-Artifact-SHA256'), RELEASE.archiveSha256);
  assert.equal(
    headers.get('Digest'),
    `sha-256=${Buffer.from(RELEASE.archiveSha256, 'hex').toString('base64')}`,
  );
  assert.equal(headers.get('Accept-Ranges'), 'none');
  assert.equal(headers.get('Cache-Control'), 'private, no-store, max-age=0');
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('ETag'), '"release-etag"');
});

test('download delivery audit is synchronous and fail-closed', async () => {
  const handlers = await readFile(
    new URL('../worker/handlers.js', import.meta.url),
    'utf8',
  );
  assert.match(handlers, /await recordDownload\(env, payload\.sessionId\);/u);
  assert.doesNotMatch(handlers, /waitUntil\(recordDownload/u);
  assert.doesNotMatch(handlers, /recordDownload\([^\n]*\.catch/u);
});

test('checkout client enables purchase only for the current release status', async () => {
  const checkout = await readFile(
    new URL('../public/assets/checkout.js', import.meta.url),
    'utf8',
  );
  assert.match(checkout, /data\.artifactVersion !== '2\.0\.0'/u);
  assert.match(
    checkout,
    /data\.archiveFilename !== 'soc-dv-gpt-5\.6-luna-customer-package-v2\.0\.0\.zip'/u,
  );
  assert.match(checkout, /artifact version 2\.0\.0 \(ZIP\)/u);
});

test('browser fulfillment routes legacy orders to explicit terms reacceptance', async () => {
  const [checkout, completion, errorPage, errorClient] = await Promise.all([
    readFile(new URL('../public/assets/checkout.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/assets/complete-checkout.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/purchase-error.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/assets/purchase-error.js', import.meta.url), 'utf8'),
  ]);
  for (const client of [checkout, completion]) {
    assert.match(client, /data\.error === 'terms_reacceptance_required'/u);
    assert.match(client, /\/purchase-error\?reason=terms_reacceptance_required/u);
  }
  assert.match(errorPage, /both exact version 1\.0\.0 documents/u);
  assert.match(errorPage, /explicit written reacceptance/u);
  assert.match(errorPage, /<script defer src="\/assets\/purchase-error\.js"><\/script>/u);
  assert.doesNotMatch(errorPage, /<script>(?:.|\n)*<\/script>/u);
  assert.match(errorClient, /terms_reacceptance_required/u);
  assert.match(errorClient, /both exact purchase documents/u);
  assert.match(errorClient, /explicit written reacceptance/u);
});

test('legacy compatibility is restricted to the two historical paid bindings', () => {
  assert.deepEqual(LEGACY_CHECKOUT_ARTIFACTS, [
    {
      artifactVersion: '1.0.0',
      archiveSha256: 'ddecf9fc5e0057d4a884b2537ea7e2c973235714fa731e9b68e5dbc8432b1dfc',
      artifactAssetPath: '/__private/artifacts/soc-dv-rlvr-diagnostic-sample-5-task/v1.0.0/sha256/ddecf9fc5e0057d4a884b2537ea7e2c973235714fa731e9b68e5dbc8432b1dfc/soc-dv-rlvr-diagnostic-sample-5-task-v1.0.0.tar.gz',
      legacy: true,
    },
    {
      artifactVersion: '1.0.2',
      archiveSha256: '24eceb7389d767099370afadbdebe8bb74a6744241f4e3957635d53ce6dbb904',
      artifactAssetPath: '/__private/artifacts/soc-dv-rlvr-diagnostic-sample-5-task/v1.0.2/sha256/24eceb7389d767099370afadbdebe8bb74a6744241f4e3957635d53ce6dbb904/soc-dv-gpt-5.3-codex-spark-customer-package-v1.0.2.zip',
      legacy: true,
    },
  ]);
});
