import assert from 'node:assert/strict';
import test from 'node:test';
import { PRODUCT } from '../worker/product.js';
import { validateFixedPrice, validatePaidSession } from '../worker/entitlement.js';

const sha = 'a'.repeat(64);
const config = {
  stripePriceId: 'price_sample',
  stripeLivemode: false,
  artifactSha256: sha,
  artifactR2Key: `artifacts/product/v1/sha256/${sha}/${PRODUCT.archiveFilename}`,
};

function paidSession() {
  return {
    id: 'cs_test_1234567890abcdef',
    status: 'complete',
    mode: 'payment',
    payment_status: 'paid',
    livemode: false,
    currency: 'usd',
    amount_subtotal: 100_000,
    amount_total: 100_000,
    created: 1_785_542_400,
    customer_details: { email: 'Buyer@Example.com' },
    metadata: {
      product_id: PRODUCT.productId,
      sku: PRODUCT.sku,
      artifact_version: PRODUCT.artifactVersion,
      artifact_sha256: sha,
      artifact_r2_key: config.artifactR2Key,
      terms_version: PRODUCT.termsVersion,
    },
    line_items: {
      has_more: false,
      data: [{
        quantity: 1,
        currency: 'usd',
        amount_subtotal: 100_000,
        price: { id: 'price_sample' },
      }],
    },
    payment_intent: {
      id: 'pi_test',
      status: 'succeeded',
      currency: 'usd',
      amount: 100_000,
      amount_received: 100_000,
      livemode: false,
      metadata: { sku: PRODUCT.sku, artifact_sha256: sha },
      latest_charge: {
        id: 'ch_test',
        paid: true,
        captured: true,
        refunded: false,
        disputed: false,
        amount: 100_000,
        amount_captured: 100_000,
        amount_refunded: 0,
        currency: 'usd',
        livemode: false,
        payment_intent: 'pi_test',
      },
    },
  };
}

test('fixed Stripe price must be active, one-time, USD $1,000', () => {
  assert.doesNotThrow(() => validateFixedPrice({
    id: 'price_sample',
    active: true,
    type: 'one_time',
    currency: 'usd',
    unit_amount: 100_000,
    livemode: false,
  }, config));
  assert.throws(() => validateFixedPrice({
    id: 'price_sample',
    active: true,
    type: 'one_time',
    currency: 'usd',
    unit_amount: 99_999,
    livemode: false,
  }, config));
});

test('a paid, exact-product session is accepted and normalized', () => {
  const paid = validatePaidSession(paidSession(), config);
  assert.equal(paid.customerEmail, 'buyer@example.com');
  assert.equal(paid.paymentIntentId, 'pi_test');
  assert.equal(paid.chargeId, 'ch_test');
});

test('wrong product, price, refund, dispute, and revocation are rejected', () => {
  const mutations = [
    (session) => { session.metadata.sku = 'wrong'; },
    (session) => { session.line_items.data[0].price.id = 'price_wrong'; },
    (session) => { session.payment_intent.latest_charge.refunded = true; },
    (session) => { session.payment_intent.latest_charge.disputed = true; },
    (session) => { session.metadata.entitlement_revoked = 'true'; },
  ];
  for (const mutate of mutations) {
    const session = paidSession();
    mutate(session);
    assert.throws(() => validatePaidSession(session, config));
  }
});
