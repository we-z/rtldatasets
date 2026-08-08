import assert from 'node:assert/strict';
import test from 'node:test';
import { LEGACY_CHECKOUT_ARTIFACTS, PRODUCT } from '../worker/product.js';
import {
  validateBrowserRecovery,
  validateFixedPrice,
  validatePaidSession,
} from '../worker/entitlement.js';

const config = {
  stripePriceId: 'price_sample',
  stripeLivemode: false,
  artifactSha256: PRODUCT.archiveSha256,
  artifactAssetPath: PRODUCT.artifactAssetPath,
  archiveBytes: PRODUCT.archiveBytes,
};

const acceptedAt = '2026-08-04T12:34:56.000Z';

function currentMetadata() {
  return {
    product_id: PRODUCT.productId,
    sku: PRODUCT.sku,
    package_id: PRODUCT.packageId,
    artifact_version: PRODUCT.artifactVersion,
    artifact_sha256: PRODUCT.archiveSha256,
    artifact_asset_path: PRODUCT.artifactAssetPath,
    archive_filename: PRODUCT.archiveFilename,
    archive_bytes: String(PRODUCT.archiveBytes),
    terms_version: PRODUCT.termsVersion,
    terms_sha256: PRODUCT.termsSha256,
    order_binding_version: PRODUCT.orderBindingVersion,
    order_binding_sha256: PRODUCT.orderBindingSha256,
    terms_accepted_at: acceptedAt,
    terms_acceptance_method: PRODUCT.acceptanceMethod,
  };
}

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
    client_reference_id: '123e4567-e89b-42d3-a456-426614174000',
    customer_details: {
      email: 'Buyer@Example.com',
      individual_name: 'Buyer Person',
      business_name: 'Buyer Organization',
      address: {
        line1: '123 Buyer Street',
        city: 'Buyer City',
        state: 'CA',
        postal_code: '90001',
        country: 'US',
      },
    },
    metadata: currentMetadata(),
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
      metadata: currentMetadata(),
      latest_charge: {
        id: 'ch_test',
        paid: true,
        captured: true,
        refunded: false,
        disputed: false,
        amount: 100_000,
        amount_captured: 100_000,
        amount_refunded: 0,
        created: 1_785_542_410,
        currency: 'usd',
        livemode: false,
        payment_intent: 'pi_test',
      },
    },
  };
}

function legacyPaidSession() {
  const session = paidSession();
  const legacy = LEGACY_CHECKOUT_ARTIFACTS[0];
  const metadata = {
    product_id: PRODUCT.productId,
    sku: PRODUCT.sku,
    artifact_version: legacy.artifactVersion,
    artifact_sha256: legacy.archiveSha256,
    artifact_asset_path: legacy.artifactAssetPath,
    terms_version: PRODUCT.termsVersion,
  };
  session.metadata = { ...metadata };
  session.payment_intent.metadata = { ...metadata };
  return session;
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
  assert.equal(paid.customerIndividualName, 'Buyer Person');
  assert.equal(paid.customerBusinessName, 'Buyer Organization');
  assert.equal(paid.customerBillingAddress.country, 'US');
  assert.equal(paid.paymentIntentId, 'pi_test');
  assert.equal(paid.chargeId, 'ch_test');
  assert.equal(paid.checkoutArtifact.legacy, false);
  assert.equal(paid.checkoutTerms.status, 'exact_document_hashes_v1');
  assert.equal(paid.checkoutTerms.acceptedAt, acceptedAt);
  assert.equal(paid.checkoutTerms.acceptanceMethod, PRODUCT.acceptanceMethod);
});

test('current checkout requires both exact documents and acceptance evidence', () => {
  const mutations = [
    (metadata) => { delete metadata.package_id; },
    (metadata) => { metadata.package_id = 'wrong-package'; },
    (metadata) => { delete metadata.archive_filename; },
    (metadata) => { metadata.archive_bytes = '1'; },
    (metadata) => { delete metadata.terms_sha256; },
    (metadata) => { metadata.terms_sha256 = 'f'.repeat(64); },
    (metadata) => { delete metadata.order_binding_version; },
    (metadata) => { metadata.order_binding_version = '9.9.9'; },
    (metadata) => { delete metadata.order_binding_sha256; },
    (metadata) => { metadata.order_binding_sha256 = 'e'.repeat(64); },
    (metadata) => { delete metadata.terms_accepted_at; },
    (metadata) => { metadata.terms_accepted_at = 'not-an-iso-timestamp'; },
    (metadata) => { delete metadata.terms_acceptance_method; },
    (metadata) => { metadata.terms_acceptance_method = 'other'; },
  ];
  for (const mutate of mutations) {
    const session = paidSession();
    mutate(session.metadata);
    assert.throws(() => validatePaidSession(session, config));
  }
});

test('payment-intent metadata must repeat the exact artifact and dual-document binding', () => {
  const mutations = [
    (metadata) => { metadata.package_id = 'wrong-package'; },
    (metadata) => { metadata.archive_filename = 'wrong.zip'; },
    (metadata) => { metadata.archive_bytes = '1'; },
    (metadata) => { metadata.artifact_version = '9.9.9'; },
    (metadata) => { metadata.artifact_sha256 = 'd'.repeat(64); },
    (metadata) => { metadata.artifact_asset_path = '/__private/wrong.zip'; },
    (metadata) => { metadata.terms_version = '9.9.9'; },
    (metadata) => { metadata.terms_sha256 = 'c'.repeat(64); },
    (metadata) => { metadata.order_binding_version = '9.9.9'; },
    (metadata) => { metadata.order_binding_sha256 = 'b'.repeat(64); },
    (metadata) => { metadata.terms_accepted_at = '2026-08-04T12:34:57.000Z'; },
    (metadata) => { metadata.terms_acceptance_method = 'other'; },
  ];
  for (const mutate of mutations) {
    const session = paidSession();
    mutate(session.payment_intent.metadata);
    assert.throws(() => validatePaidSession(session, config));
  }
});

test('current checkout requires retained purchaser identity and billing address', () => {
  const mutations = [
    (session) => { delete session.customer_details.individual_name; },
    (session) => { session.customer_details.individual_name = '   '; },
    (session) => { session.customer_details.business_name = '\u0000bad'; },
    (session) => { delete session.customer_details.address; },
    (session) => { session.customer_details.address.line1 = ''; },
    (session) => { session.customer_details.address.country = 'USA'; },
  ];
  for (const mutate of mutations) {
    const session = paidSession();
    mutate(session);
    assert.throws(() => validatePaidSession(session, config));
  }
  const individual = paidSession();
  delete individual.customer_details.business_name;
  assert.equal(validatePaidSession(individual, config).customerBusinessName, null);
});

test('the exact historical v1.0.0 binding fails closed pending terms reacceptance', () => {
  assert.throws(
    () => validatePaidSession(legacyPaidSession(), config),
    (error) => error?.status === 403 && error?.publicCode === 'terms_reacceptance_required',
  );

  const mutations = [
    (session) => { session.metadata.artifact_version = '0.9.9'; },
    (session) => { session.metadata.artifact_sha256 = 'a'.repeat(64); },
    (session) => { session.metadata.artifact_asset_path = '/__private/legacy-lookalike.tar.gz'; },
    (session) => { delete session.metadata.terms_version; },
    (session) => { session.metadata.terms_sha256 = PRODUCT.termsSha256; },
    (session) => { session.metadata.order_binding_version = PRODUCT.orderBindingVersion; },
    (session) => { session.metadata.order_binding_sha256 = PRODUCT.orderBindingSha256; },
    (session) => { session.metadata.terms_accepted_at = acceptedAt; },
    (session) => { session.metadata.terms_acceptance_method = PRODUCT.acceptanceMethod; },
  ];
  for (const mutate of mutations) {
    const session = legacyPaidSession();
    mutate(session);
    assert.throws(
      () => validatePaidSession(session, config),
      (error) => error?.publicCode === 'invalid_purchase',
    );
  }
});

test('wrong product, price, refund, dispute, and revocation are rejected', () => {
  const mutations = [
    (session) => { session.metadata.sku = 'wrong'; },
    (session) => { session.line_items.data[0].price.id = 'price_wrong'; },
    (session) => { session.payment_intent.latest_charge.refunded = true; },
    (session) => { session.payment_intent.latest_charge.disputed = true; },
    (session) => { session.metadata.entitlement_revoked = 'true'; },
    (session) => { session.client_reference_id = 'not-a-checkout-attempt'; },
  ];
  for (const mutate of mutations) {
    const session = paidSession();
    mutate(session);
    assert.throws(() => validatePaidSession(session, config));
  }
});

test('browser recovery requires a matching attempt and a recent Stripe charge', () => {
  const paid = validatePaidSession(paidSession(), config);
  const attemptId = paid.session.client_reference_id;
  const now = paid.charge.created + 7 * 24 * 60 * 60 - 1;
  assert.equal(validateBrowserRecovery(paid, [attemptId], now), attemptId);
  assert.throws(() => validateBrowserRecovery(paid, ['123e4567-e89b-42d3-b456-426614174001'], now));
  assert.throws(() => validateBrowserRecovery(paid, [attemptId], now + 1));

  const future = validatePaidSession(paidSession(), config);
  assert.throws(() => validateBrowserRecovery(future, [attemptId], future.charge.created - 301));
});
