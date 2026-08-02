import { getStoreConfig } from './config.js';
import { PRODUCT, TOKEN_LIFETIMES } from './product.js';
import { createStripe } from './stripe.js';
import { validateFixedPrice } from './entitlement.js';
import { loadVerifiedArtifact } from './artifact.js';
import { assertMethod, assertSameOrigin, HttpError, readUrlEncodedForm, redirect } from './http.js';
import {
  checkoutCookieName,
  checkoutStatePayload,
  cookieNames,
  serializeCookie,
  signToken,
  validAttemptId,
} from './tokens.js';

export async function createCheckout(request, env) {
  assertMethod(request, 'POST');
  if (env.STORE_LIVE !== 'true') throw new HttpError(503, 'store_unavailable');
  const config = getStoreConfig(env);
  assertSameOrigin(request, config.siteOrigin);

  const form = await readUrlEncodedForm(request);
  const attemptId = form.get('attempt_id');
  if (!validAttemptId(attemptId)) throw new HttpError(400, 'invalid_checkout_attempt');
  if (form.get('terms_accepted') !== 'yes' || form.get('terms_version') !== PRODUCT.termsVersion) {
    throw new HttpError(400, 'terms_required');
  }

  const rateKey = request.headers.get('CF-Connecting-IP') || 'unknown-client';
  const rate = await env.CHECKOUT_RATE_LIMITER.limit({ key: `checkout:${rateKey}` });
  if (!rate.success) throw new HttpError(429, 'checkout_rate_limited');
  await loadVerifiedArtifact(env, config);

  const stripe = createStripe(config);
  validateFixedPrice(await stripe.prices.retrieve(config.stripePriceId), config);

  const metadata = {
    product_id: PRODUCT.productId,
    sku: PRODUCT.sku,
    artifact_version: PRODUCT.artifactVersion,
    artifact_sha256: config.artifactSha256,
    artifact_asset_path: config.artifactAssetPath,
    terms_version: PRODUCT.termsVersion,
  };
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_creation: 'always',
    billing_address_collection: 'required',
    client_reference_id: attemptId,
    line_items: [{ price: config.stripePriceId, quantity: 1 }],
    metadata,
    payment_intent_data: {
      description: PRODUCT.name,
      metadata,
    },
    automatic_tax: { enabled: config.automaticTax },
    success_url: `${config.siteOrigin}/purchase-complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.siteOrigin}/sample?checkout=cancelled`,
  }, {
    idempotencyKey: `checkout:${PRODUCT.sku}:${attemptId}`,
  });

  if (!session.url) throw new HttpError(502, 'checkout_unavailable');
  const checkoutUrl = new URL(session.url);
  if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com') {
    throw new HttpError(502, 'checkout_unavailable');
  }

  const names = cookieNames(config.siteOrigin);
  const checkoutCookie = checkoutCookieName(config.siteOrigin, attemptId);
  const stateToken = await signToken(checkoutStatePayload(attemptId), config.signingSecret);
  return redirect(session.url, 303, {
    'Set-Cookie': serializeCookie(
      checkoutCookie,
      stateToken,
      TOKEN_LIFETIMES.checkoutStateSeconds,
      names.secure,
    ),
  });
}
