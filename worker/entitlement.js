import { LEGACY_CHECKOUT_ARTIFACTS, PRODUCT, TOKEN_LIFETIMES } from './product.js';
import { HttpError } from './http.js';
import { recentAttemptsContain, validAttemptId } from './tokens.js';

function requireObject(value, code) {
  if (!value || typeof value !== 'object') throw new HttpError(403, code);
  return value;
}

function priceId(lineItem) {
  return typeof lineItem?.price === 'string' ? lineItem.price : lineItem?.price?.id;
}

function objectId(value) {
  return typeof value === 'string' ? value : value?.id;
}

function normalizedCustomerName(value, required) {
  if ((value === undefined || value === null || value === '') && !required) return null;
  if (typeof value !== 'string') throw new HttpError(403, 'invalid_purchase');
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > 150 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new HttpError(403, 'invalid_purchase');
  }
  return normalized;
}

function checkoutArtifactBinding(metadata, config) {
  const current = {
    artifactVersion: PRODUCT.artifactVersion,
    archiveSha256: config.artifactSha256,
    artifactAssetPath: config.artifactAssetPath,
    legacy: false,
  };
  const binding = [current, ...LEGACY_CHECKOUT_ARTIFACTS].find((candidate) =>
    metadata.artifact_version === candidate.artifactVersion &&
    metadata.artifact_sha256 === candidate.archiveSha256 &&
    metadata.artifact_asset_path === candidate.artifactAssetPath
  );
  return binding ? { ...binding } : undefined;
}

function validAcceptanceTimestamp(value) {
  if (typeof value !== 'string' || value.length > 40) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function checkoutTermsBinding(metadata, checkoutArtifact) {
  const exact =
    metadata.terms_version === PRODUCT.termsVersion &&
    metadata.terms_sha256 === PRODUCT.termsSha256 &&
    metadata.order_binding_version === PRODUCT.orderBindingVersion &&
    metadata.order_binding_sha256 === PRODUCT.orderBindingSha256 &&
    metadata.terms_acceptance_method === PRODUCT.acceptanceMethod &&
    validAcceptanceTimestamp(metadata.terms_accepted_at);
  if (exact) {
    return {
      status: 'exact_document_hashes_v1',
      acceptedAt: metadata.terms_accepted_at,
      acceptanceMethod: metadata.terms_acceptance_method,
    };
  }
  const legacyFieldsAbsent = [
    'terms_sha256',
    'order_binding_version',
    'order_binding_sha256',
    'terms_accepted_at',
    'terms_acceptance_method',
  ].every((name) => metadata[name] === undefined || metadata[name] === null);
  if (
    checkoutArtifact?.legacy === true &&
    metadata.terms_version === PRODUCT.termsVersion &&
    legacyFieldsAbsent
  ) {
    return {
      status: 'legacy_v1.0.0_unhashed_assent',
      acceptedAt: null,
      acceptanceMethod: null,
    };
  }
  return undefined;
}

export function validateFixedPrice(price, config) {
  if (
    !price ||
    price.id !== config.stripePriceId ||
    price.active !== true ||
    price.type !== 'one_time' ||
    price.currency !== PRODUCT.currency ||
    price.unit_amount !== PRODUCT.priceCents ||
    price.livemode !== config.stripeLivemode
  ) {
    throw new HttpError(503, 'price_misconfigured');
  }
  return price;
}

export function validatePaidSession(session, config) {
  requireObject(session, 'invalid_purchase');
  const metadata = session.metadata || {};
  const checkoutArtifact = checkoutArtifactBinding(metadata, config);
  const checkoutTerms = checkoutTermsBinding(metadata, checkoutArtifact);
  if (
    session.status !== 'complete' ||
    session.mode !== 'payment' ||
    session.payment_status !== 'paid' ||
    session.livemode !== config.stripeLivemode ||
    !validAttemptId(session.client_reference_id) ||
    metadata.product_id !== PRODUCT.productId ||
    metadata.sku !== PRODUCT.sku ||
    !checkoutArtifact ||
    !checkoutTerms ||
    metadata.entitlement_revoked === 'true'
  ) {
    throw new HttpError(403, 'invalid_purchase');
  }
  if (checkoutTerms.status === 'legacy_v1.0.0_unhashed_assent') {
    // Historical metadata is recognized only so an existing purchaser can be
    // directed through explicit reacceptance. It never grants an entitlement.
    throw new HttpError(403, 'terms_reacceptance_required');
  }
  if (
    metadata.package_id !== PRODUCT.packageId ||
    metadata.archive_filename !== PRODUCT.archiveFilename ||
    metadata.archive_bytes !== String(config.archiveBytes)
  ) {
    throw new HttpError(403, 'invalid_purchase');
  }

  const items = session.line_items;
  if (!items || items.has_more === true || !Array.isArray(items.data) || items.data.length !== 1) {
    throw new HttpError(403, 'invalid_purchase');
  }
  const item = items.data[0];
  if (
    priceId(item) !== config.stripePriceId ||
    item.quantity !== 1 ||
    item.currency !== PRODUCT.currency ||
    item.amount_subtotal !== PRODUCT.priceCents ||
    session.currency !== PRODUCT.currency ||
    session.amount_subtotal !== PRODUCT.priceCents ||
    !Number.isSafeInteger(session.amount_total) ||
    session.amount_total < PRODUCT.priceCents
  ) {
    throw new HttpError(403, 'invalid_purchase');
  }

  const paymentIntent = requireObject(session.payment_intent, 'invalid_purchase');
  const paymentMetadata = paymentIntent.metadata || {};
  const paymentTermsMatch =
    paymentMetadata.terms_version === PRODUCT.termsVersion &&
    paymentMetadata.terms_sha256 === PRODUCT.termsSha256 &&
    paymentMetadata.order_binding_version === PRODUCT.orderBindingVersion &&
    paymentMetadata.order_binding_sha256 === PRODUCT.orderBindingSha256 &&
    paymentMetadata.terms_accepted_at === checkoutTerms.acceptedAt &&
    paymentMetadata.terms_acceptance_method === PRODUCT.acceptanceMethod;
  const paymentPackageMatch =
    paymentMetadata.package_id === PRODUCT.packageId &&
    paymentMetadata.archive_filename === PRODUCT.archiveFilename &&
    paymentMetadata.archive_bytes === String(config.archiveBytes);
  if (
    paymentIntent.status !== 'succeeded' ||
    paymentIntent.currency !== PRODUCT.currency ||
    paymentIntent.amount !== session.amount_total ||
    paymentIntent.amount_received !== session.amount_total ||
    paymentIntent.livemode !== config.stripeLivemode ||
    paymentMetadata.product_id !== PRODUCT.productId ||
    paymentMetadata.sku !== PRODUCT.sku ||
    paymentMetadata.artifact_version !== checkoutArtifact.artifactVersion ||
    paymentMetadata.artifact_sha256 !== checkoutArtifact.archiveSha256 ||
    paymentMetadata.artifact_asset_path !== checkoutArtifact.artifactAssetPath ||
    !paymentPackageMatch ||
    !paymentTermsMatch
  ) {
    throw new HttpError(403, 'invalid_purchase');
  }

  const charge = requireObject(paymentIntent.latest_charge, 'invalid_purchase');
  if (
    charge.paid !== true ||
    charge.captured !== true ||
    charge.refunded === true ||
    charge.disputed === true ||
    charge.amount !== session.amount_total ||
    charge.amount_captured !== session.amount_total ||
    charge.amount_refunded !== 0 ||
    charge.currency !== PRODUCT.currency ||
    charge.livemode !== config.stripeLivemode ||
    !Number.isInteger(charge.created) ||
    objectId(charge.payment_intent) !== objectId(paymentIntent)
  ) {
    throw new HttpError(403, 'purchase_inactive');
  }

  const customerEmail = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(customerEmail) || customerEmail.length > 254) {
    throw new HttpError(403, 'invalid_purchase');
  }
  const customerIndividualName = normalizedCustomerName(
    session.customer_details?.individual_name,
    true,
  );
  const customerBusinessName = normalizedCustomerName(
    session.customer_details?.business_name,
    false,
  );
  const billingAddress = session.customer_details?.address;
  if (
    !billingAddress ||
    typeof billingAddress !== 'object' ||
    typeof billingAddress.line1 !== 'string' ||
    !billingAddress.line1.trim() ||
    typeof billingAddress.country !== 'string' ||
    !/^[A-Z]{2}$/u.test(billingAddress.country)
  ) {
    throw new HttpError(403, 'invalid_purchase');
  }

  return Object.freeze({
    session,
    paymentIntent,
    charge,
    customerEmail,
    customerIndividualName,
    customerBusinessName,
    customerBillingAddress: Object.freeze({ ...billingAddress }),
    paymentIntentId: objectId(paymentIntent),
    chargeId: objectId(charge),
    checkoutArtifact,
    checkoutTerms,
  });
}

export async function loadPaidSession(stripe, sessionId, config) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items.data.price', 'payment_intent.latest_charge'],
  });
  return validatePaidSession(session, config);
}

export function validateBrowserRecovery(
  paid,
  attemptIds,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const attemptId = paid?.session?.client_reference_id;
  const created = paid?.charge?.created;
  if (
    !validAttemptId(attemptId) ||
    !recentAttemptsContain(attemptIds, attemptId) ||
    !Number.isInteger(created) ||
    created > nowSeconds + 5 * 60 ||
    created + TOKEN_LIFETIMES.browserRecoverySeconds <= nowSeconds
  ) {
    throw new HttpError(403, 'invalid_purchase');
  }
  return attemptId;
}
