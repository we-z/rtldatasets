import { PRODUCT } from './product.js';
import { HttpError } from './http.js';

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
  if (
    session.status !== 'complete' ||
    session.mode !== 'payment' ||
    session.payment_status !== 'paid' ||
    session.livemode !== config.stripeLivemode ||
    metadata.product_id !== PRODUCT.productId ||
    metadata.sku !== PRODUCT.sku ||
    metadata.artifact_version !== PRODUCT.artifactVersion ||
    metadata.artifact_sha256 !== config.artifactSha256 ||
    metadata.artifact_r2_key !== config.artifactR2Key ||
    metadata.terms_version !== PRODUCT.termsVersion ||
    metadata.entitlement_revoked === 'true'
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
  if (
    paymentIntent.status !== 'succeeded' ||
    paymentIntent.currency !== PRODUCT.currency ||
    paymentIntent.amount !== session.amount_total ||
    paymentIntent.amount_received !== session.amount_total ||
    paymentIntent.livemode !== config.stripeLivemode ||
    paymentIntent.metadata?.sku !== PRODUCT.sku ||
    paymentIntent.metadata?.artifact_sha256 !== config.artifactSha256
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
    objectId(charge.payment_intent) !== objectId(paymentIntent)
  ) {
    throw new HttpError(403, 'purchase_inactive');
  }

  const customerEmail = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(customerEmail) || customerEmail.length > 254) {
    throw new HttpError(403, 'invalid_purchase');
  }

  return Object.freeze({
    session,
    paymentIntent,
    charge,
    customerEmail,
    paymentIntentId: objectId(paymentIntent),
    chargeId: objectId(charge),
  });
}

export async function loadPaidSession(stripe, sessionId, config) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items.data.price', 'payment_intent.latest_charge'],
  });
  return validatePaidSession(session, config);
}
