import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { recoverPurchase } from '../worker/handlers.js';
import { PRODUCT } from '../worker/product.js';
import { verifyToken } from '../worker/tokens.js';

const siteOrigin = 'https://www.rtldatasets.com';
const signingSecret = 'a-recovery-test-signing-secret-more-than-32-bytes';
const sha = 'a'.repeat(64);
const attemptId = '123e4567-e89b-42d3-a456-426614174000';
const sessionId = 'cs_test_recovery123456789';

function recoveryEnvironment() {
  return {
    SITE_URL: siteOrigin,
    STRIPE_SECRET_KEY: 'sk_test_recovery',
    STRIPE_MODE: 'test',
    STRIPE_WEBHOOK_SECRET: 'whsec_recovery',
    STRIPE_SAMPLE_PRICE_ID: 'price_recovery',
    ENTITLEMENT_SIGNING_SECRET: signingSecret,
    SAMPLE_ARCHIVE_SHA256: sha,
    SAMPLE_ASSET_PATH: `/__private/artifacts/product/v1/sha256/${sha}/${PRODUCT.archiveFilename}`,
    SAMPLE_ARCHIVE_BYTES: '69675',
    CHECKOUT_RATE_LIMITER: { limit: async () => ({ success: true }) },
    ORDERS: {},
    ASSETS: {},
  };
}

function recoveryRequest(origin = siteOrigin) {
  return new Request(`${siteOrigin}/api/recover-purchase`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: new URLSearchParams({ attempt_id: attemptId }),
  });
}

test('checkout completion and webhook recovery restore access without URL attempt IDs', async () => {
  const [checkout, completion, worker, handlers] = await Promise.all([
    readFile(new URL('../public/assets/checkout.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/assets/complete-checkout.js', import.meta.url), 'utf8'),
    readFile(new URL('../worker/checkout.js', import.meta.url), 'utf8'),
    readFile(new URL('../worker/handlers.js', import.meta.url), 'utf8'),
  ]);

  assert.match(checkout, /rtl_checkout_attempts_v1/u);
  assert.match(checkout, /\/api\/recover-purchase/u);
  assert.match(completion, /fetch\('\/api\/checkout-success'/u);
  assert.match(completion, /Retrying automatically/u);
  assert.match(worker, /purchase-complete\?session_id=\{CHECKOUT_SESSION_ID\}/u);
  assert.doesNotMatch(worker, /purchase-complete[^\n]*attempt_id/u);
  assert.doesNotMatch(handlers, /sessionId[^\n]*JSON/u);
});

test('browser-back checkout state is reloaded and the checkout client is never served stale', async () => {
  const [checkout, headers] = await Promise.all([
    readFile(new URL('../public/assets/checkout.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/_headers', import.meta.url), 'utf8'),
  ]);

  assert.match(
    checkout,
    /window\.addEventListener\('pageshow', \(event\) => \{\s*if \(event\.persisted\) window\.location\.reload\(\);\s*\}\);/u,
  );
  assert.match(
    headers,
    /\/assets\/checkout\.js\s+Cache-Control: private, no-store, max-age=0/u,
  );
});

test('recovery handler revalidates Stripe and issues only an HttpOnly entitlement cookie', async () => {
  const now = 2_000_000_000;
  let recorded = 0;
  const response = await recoverPurchase(recoveryRequest(), recoveryEnvironment(), {
    findRecoverablePurchase: async () => ({
      checkout_session_id: sessionId,
      checkout_attempt_id: attemptId,
    }),
    loadPaidSession: async () => ({
      session: { id: sessionId, client_reference_id: attemptId },
      charge: { created: now - 60 },
    }),
    recordPurchase: async () => { recorded += 1; },
    nowSeconds: () => now,
  });

  assert.equal(response.status, 200);
  assert.equal(recorded, 1);
  assert.match(response.headers.get('Cache-Control'), /no-store/u);
  const cookies = response.headers.get('Set-Cookie');
  assert.match(cookies, /__Host-rtl_entitlement=/u);
  assert.match(cookies, /HttpOnly/u);
  assert.match(cookies, /Secure/u);
  assert.match(cookies, /SameSite=Lax/u);
  assert.match(cookies, /Max-Age=43200/u);

  const body = await response.json();
  assert.deepEqual(body, {
    recovered: true,
    redirect: '/purchase-success',
    matchedAttemptIndex: 0,
  });
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /cs_test_|123e4567|entitlement|email|amount/iu);

  const token = /__Host-rtl_entitlement=([^;,]+)/u.exec(cookies)?.[1];
  const payload = await verifyToken(token, 'entitlement', signingSecret);
  assert.equal(payload.sessionId, sessionId);
});

test('recovery handler performs no Stripe lookup when the webhook mapping is absent', async () => {
  let stripeCalls = 0;
  const response = await recoverPurchase(recoveryRequest(), recoveryEnvironment(), {
    findRecoverablePurchase: async () => null,
    loadPaidSession: async () => { stripeCalls += 1; },
  });
  assert.equal(stripeCalls, 0);
  assert.deepEqual(await response.json(), { recovered: false });
  assert.equal(response.headers.has('Set-Cookie'), false);
});

test('recovery handler rejects stale Stripe charges and wrong origins', async () => {
  const now = 2_000_000_000;
  const dependencies = {
    findRecoverablePurchase: async () => ({
      checkout_session_id: sessionId,
      checkout_attempt_id: attemptId,
    }),
    loadPaidSession: async () => ({
      session: { id: sessionId, client_reference_id: attemptId },
      charge: { created: now - 7 * 24 * 60 * 60 },
    }),
    recordPurchase: async () => undefined,
    nowSeconds: () => now,
  };
  await assert.rejects(
    () => recoverPurchase(recoveryRequest(), recoveryEnvironment(), dependencies),
    (error) => error?.status === 403,
  );
  await assert.rejects(
    () => recoverPurchase(recoveryRequest('https://attacker.example'), recoveryEnvironment(), dependencies),
    (error) => error?.status === 403,
  );
});
