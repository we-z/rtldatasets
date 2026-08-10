import { PRODUCT, TOKEN_LIFETIMES } from './product.js';
import { HttpError } from './http.js';
import { validAttemptId, validRecentAttempts } from './tokens.js';
import { getPool } from './db-pool.js';

function nowIso(nowMs = Date.now()) {
  return new Date(nowMs).toISOString();
}

export async function recordPurchase(env, paid, config, nowMs = Date.now()) {
  const timestamp = nowIso(nowMs);
  const stripeCreatedAt = new Date(paid.charge.created * 1000).toISOString();
  const redeemExpiresAt = paid.charge.created + TOKEN_LIFETIMES.redeemSeconds;
  const checkoutAttemptId = paid.session.client_reference_id;
  if (!validAttemptId(checkoutAttemptId)) throw new HttpError(403, 'invalid_purchase');

  const pool = getPool(env);
  await pool.query(`
    INSERT INTO fulfillments (
      checkout_session_id, checkout_attempt_id, payment_intent_id, charge_id, customer_email,
      product_id, sku, artifact_version, artifact_sha256, artifact_asset_path,
      archive_bytes, terms_version, currency, amount_subtotal, amount_total,
      livemode, redeem_expires_at, stripe_created_at, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    ON CONFLICT (checkout_session_id) DO UPDATE SET
      checkout_attempt_id = excluded.checkout_attempt_id,
      payment_intent_id = excluded.payment_intent_id,
      charge_id = excluded.charge_id,
      customer_email = excluded.customer_email,
      product_id = excluded.product_id,
      sku = excluded.sku,
      artifact_version = excluded.artifact_version,
      artifact_sha256 = excluded.artifact_sha256,
      artifact_asset_path = excluded.artifact_asset_path,
      archive_bytes = excluded.archive_bytes,
      terms_version = excluded.terms_version,
      currency = excluded.currency,
      amount_subtotal = excluded.amount_subtotal,
      amount_total = excluded.amount_total,
      livemode = excluded.livemode,
      redeem_expires_at = excluded.redeem_expires_at,
      stripe_created_at = excluded.stripe_created_at,
      updated_at = excluded.updated_at
  `, [
    paid.session.id,
    checkoutAttemptId,
    paid.paymentIntentId,
    paid.chargeId,
    paid.customerEmail,
    PRODUCT.productId,
    PRODUCT.sku,
    PRODUCT.artifactVersion,
    config.artifactSha256,
    config.artifactAssetPath,
    config.archiveBytes,
    PRODUCT.termsVersion,
    PRODUCT.currency,
    PRODUCT.priceCents,
    paid.session.amount_total,
    config.stripeLivemode,
    redeemExpiresAt,
    stripeCreatedAt,
    timestamp,
    timestamp,
  ]);

  const { rows } = await pool.query(
    'SELECT * FROM fulfillments WHERE checkout_session_id = $1',
    [paid.session.id],
  );
  return rows[0];
}

export async function findRecoverablePurchase(env, attemptIds, livemode, nowMs = Date.now()) {
  if (!validRecentAttempts(attemptIds)) throw new HttpError(400, 'invalid_checkout_attempt');
  const notBefore = nowIso(nowMs - TOKEN_LIFETIMES.browserRecoverySeconds * 1000);
  const pool = getPool(env);
  const placeholders = attemptIds.map((_, index) => `$${index + 4}`).join(', ');
  const { rows } = await pool.query(`
    SELECT checkout_session_id, checkout_attempt_id
    FROM fulfillments
    WHERE sku = $1
      AND livemode = $2
      AND stripe_created_at >= $3
      AND checkout_attempt_id IN (${placeholders})
    ORDER BY stripe_created_at DESC
    LIMIT 1
  `, [
    PRODUCT.sku,
    livemode,
    notBefore,
    ...attemptIds,
  ]);
  return rows[0];
}

export async function recordDownload(env, sessionId, nowMs = Date.now()) {
  const timestamp = nowIso(nowMs);
  const pool = getPool(env);
  const result = await pool.query(`
    UPDATE fulfillments
    SET download_count = download_count + 1,
        first_download_at = COALESCE(first_download_at, $1),
        last_download_at = $2,
        updated_at = $3
    WHERE checkout_session_id = $4
  `, [timestamp, timestamp, timestamp, sessionId]);
  if (result.rowCount !== 1) {
    throw new HttpError(503, 'delivery_record_unavailable');
  }
  return timestamp;
}
