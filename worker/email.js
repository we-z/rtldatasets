import { PRODUCT } from './product.js';
import { redeemPayload, signToken } from './tokens.js';
import {
  claimEmailDelivery,
  completeEmailDelivery,
  recordPurchase,
  releaseEmailDelivery,
} from './database.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildRedeemUrl(siteOrigin, token) {
  return `${siteOrigin}/purchase-access#token=${encodeURIComponent(token)}`;
}

export async function ensureDeliveryEmail(env, paid, config, nowMs = Date.now()) {
  const order = await recordPurchase(env, paid, config, nowMs);
  if (order.delivery_status === 'sent') return order.delivery_message_id;

  const token = await signToken(
    redeemPayload(paid.session.id, order.redeem_expires_at),
    config.signingSecret,
  );
  // URL fragments are never sent in HTTP requests, keeping the bearer token
  // out of Cloudflare invocation URLs and intermediary logs. The redemption
  // page exchanges it in a same-origin POST.
  const redeemUrl = buildRedeemUrl(config.siteOrigin, token);
  const safeUrl = escapeHtml(redeemUrl);
  const leaseId = await claimEmailDelivery(env, paid.session.id, nowMs);
  if (!leaseId) {
    const current = await env.ORDERS.prepare(
      'SELECT delivery_status, delivery_message_id FROM fulfillments WHERE checkout_session_id = ?',
    ).bind(paid.session.id).first();
    if (current?.delivery_status === 'sent') return current.delivery_message_id;
    throw new Error('Delivery is already in progress');
  }

  let result;
  try {
    result = await env.EMAIL.send({
      to: paid.customerEmail,
      from: { email: config.fulfillmentFromEmail, name: 'RTL Datasets' },
      replyTo: PRODUCT.supportEmail,
      subject: `Your ${PRODUCT.name} download`,
      text: [
        'Payment confirmed.',
        '',
        `Use this private link to access ${PRODUCT.name}:`,
        redeemUrl,
        '',
        'The link expires 30 days after purchase. Each download is rechecked against the current Stripe payment, refund, and dispute state.',
        '',
        `Support: ${PRODUCT.supportEmail}`,
      ].join('\n'),
      html: [
        '<h1>Payment confirmed</h1>',
        `<p>Your <strong>${escapeHtml(PRODUCT.name)}</strong> is ready.</p>`,
        `<p><a href="${safeUrl}">Access your private download</a></p>`,
        '<p>This link expires 30 days after purchase. Each download is rechecked against the current payment, refund, and dispute state.</p>',
        `<p>Support: <a href="mailto:${PRODUCT.supportEmail}">${PRODUCT.supportEmail}</a></p>`,
      ].join(''),
      headers: {
        'X-Entity-Ref-ID': `fulfillment-${paid.session.id}`,
      },
    });
  } catch (error) {
    await releaseEmailDelivery(
      env,
      paid.session.id,
      leaseId,
      error?.code || error?.name || 'email_error',
      nowMs,
    );
    throw error;
  }

  if (typeof result?.messageId !== 'string' || result.messageId === '') {
    await releaseEmailDelivery(env, paid.session.id, leaseId, 'missing_email_message_id', nowMs);
    throw new Error('Email provider did not return a message ID');
  }
  // If this durable write fails after provider acceptance, leave the lease in
  // place rather than letting this stale invocation release a newer claim.
  await completeEmailDelivery(env, paid.session.id, leaseId, result.messageId, nowMs);
  return result.messageId;
}
