import { PRODUCT, TOKEN_LIFETIMES } from './product.js';

function nowIso(nowMs = Date.now()) {
  return new Date(nowMs).toISOString();
}

export async function recordPurchase(env, paid, config, nowMs = Date.now()) {
  const timestamp = nowIso(nowMs);
  const stripeCreatedAt = new Date(paid.session.created * 1000).toISOString();
  const redeemExpiresAt = paid.session.created + TOKEN_LIFETIMES.redeemSeconds;

  await env.ORDERS.prepare(`
    INSERT INTO fulfillments (
      checkout_session_id, payment_intent_id, charge_id, customer_email,
      product_id, sku, artifact_version, artifact_sha256, artifact_r2_key,
      archive_bytes, terms_version, currency, amount_subtotal, amount_total,
      livemode, redeem_expires_at, stripe_created_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(checkout_session_id) DO UPDATE SET
      payment_intent_id = excluded.payment_intent_id,
      charge_id = excluded.charge_id,
      customer_email = excluded.customer_email,
      amount_total = excluded.amount_total,
      updated_at = excluded.updated_at
  `).bind(
    paid.session.id,
    paid.paymentIntentId,
    paid.chargeId,
    paid.customerEmail,
    PRODUCT.productId,
    PRODUCT.sku,
    PRODUCT.artifactVersion,
    config.artifactSha256,
    config.artifactR2Key,
    config.archiveBytes,
    PRODUCT.termsVersion,
    PRODUCT.currency,
    PRODUCT.priceCents,
    paid.session.amount_total,
    config.stripeLivemode ? 1 : 0,
    redeemExpiresAt,
    stripeCreatedAt,
    timestamp,
    timestamp,
  ).run();

  return env.ORDERS.prepare(
    'SELECT * FROM fulfillments WHERE checkout_session_id = ?',
  ).bind(paid.session.id).first();
}

export async function claimEmailDelivery(env, sessionId, nowMs = Date.now()) {
  const nowSeconds = Math.floor(nowMs / 1000);
  const leaseUntil = nowSeconds + 120;
  const leaseId = crypto.randomUUID();
  const result = await env.ORDERS.prepare(`
    UPDATE fulfillments
    SET delivery_status = 'sending',
        delivery_lease_until = ?,
        delivery_lease_id = ?,
        delivery_attempts = delivery_attempts + 1,
        last_delivery_error = NULL,
        updated_at = ?
    WHERE checkout_session_id = ?
      AND (
        delivery_status = 'pending'
        OR (delivery_status = 'sending' AND COALESCE(delivery_lease_until, 0) < ?)
      )
  `).bind(leaseUntil, leaseId, nowIso(nowMs), sessionId, nowSeconds).run();
  return result.meta.changes === 1 ? leaseId : null;
}

export async function completeEmailDelivery(env, sessionId, leaseId, messageId, nowMs = Date.now()) {
  const timestamp = nowIso(nowMs);
  const result = await env.ORDERS.prepare(`
    UPDATE fulfillments
    SET delivery_status = 'sent',
        delivery_lease_until = NULL,
        delivery_lease_id = NULL,
        delivery_message_id = ?,
        delivery_sent_at = ?,
        last_delivery_error = NULL,
        updated_at = ?
    WHERE checkout_session_id = ?
      AND delivery_status = 'sending'
      AND delivery_lease_id = ?
  `).bind(messageId, timestamp, timestamp, sessionId, leaseId).run();
  if (result.meta.changes !== 1) throw new Error('Email delivery lease was lost');
}

export async function releaseEmailDelivery(env, sessionId, leaseId, errorCode, nowMs = Date.now()) {
  const result = await env.ORDERS.prepare(`
    UPDATE fulfillments
    SET delivery_status = 'pending',
        delivery_lease_until = NULL,
        delivery_lease_id = NULL,
        last_delivery_error = ?,
        updated_at = ?
    WHERE checkout_session_id = ?
      AND delivery_status = 'sending'
      AND delivery_lease_id = ?
  `).bind(String(errorCode).slice(0, 120), nowIso(nowMs), sessionId, leaseId).run();
  return result.meta.changes === 1;
}

export async function recordDownload(env, sessionId, nowMs = Date.now()) {
  const timestamp = nowIso(nowMs);
  await env.ORDERS.prepare(`
    UPDATE fulfillments
    SET download_count = download_count + 1,
        first_download_at = COALESCE(first_download_at, ?),
        last_download_at = ?,
        updated_at = ?
    WHERE checkout_session_id = ?
  `).bind(timestamp, timestamp, timestamp, sessionId).run();
}
