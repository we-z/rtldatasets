import { PRODUCT, TOKEN_LIFETIMES } from './product.js';
import { getSiteOrigin, getStoreAvailability, getStoreConfig } from './config.js';
import { createStripe, stripeCryptoProvider } from './stripe.js';
import { loadPaidSession } from './entitlement.js';
import { ensureDeliveryEmail } from './email.js';
import { recordDownload, recordPurchase } from './database.js';
import { loadVerifiedArtifact } from './artifact.js';
import {
  assertMethod,
  assertSameOrigin,
  HttpError,
  json,
  NO_STORE_HEADERS,
  readUrlEncodedForm,
  redirect,
  safeErrorCode,
} from './http.js';
import {
  cookieNames,
  entitlementPayload,
  readCookie,
  serializeCookie,
  signToken,
  validCheckoutSessionId,
  verifyToken,
} from './tokens.js';

function hexToBase64(hex) {
  let binary = '';
  for (let index = 0; index < hex.length; index += 2) {
    binary += String.fromCharCode(Number.parseInt(hex.slice(index, index + 2), 16));
  }
  return btoa(binary);
}

export async function storeStatus(request, env) {
  assertMethod(request, 'GET');
  let { available } = getStoreAvailability(env);
  if (available) {
    try {
      await loadVerifiedArtifact(env, getStoreConfig(env));
    } catch {
      available = false;
    }
  }
  return json({
    available,
    product: PRODUCT.name,
    price: '$1,000',
    currency: 'USD',
  });
}

export async function checkoutSuccess(request, env, ctx) {
  assertMethod(request, 'GET');
  const config = getStoreConfig(env);
  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (!validCheckoutSessionId(sessionId)) throw new HttpError(400, 'invalid_purchase');

  const names = cookieNames(config.siteOrigin);
  const stateToken = readCookie(request, names.checkout);
  const state = await verifyToken(stateToken, 'checkout', config.signingSecret);
  const stripe = createStripe(config);
  const paid = await loadPaidSession(stripe, sessionId, config);
  if (paid.session.client_reference_id !== state.attemptId) {
    throw new HttpError(403, 'invalid_purchase');
  }

  await recordPurchase(env, paid, config);
  ctx.waitUntil(ensureDeliveryEmail(env, paid, config).catch(() => undefined));

  const accessToken = await signToken(entitlementPayload(sessionId), config.signingSecret);
  return redirect(`${config.siteOrigin}/purchase-success`, 303, {
    'Set-Cookie': [
      serializeCookie(
        names.entitlement,
        accessToken,
        TOKEN_LIFETIMES.entitlementSeconds,
        names.secure,
      ),
      serializeCookie(names.checkout, '', 0, names.secure),
    ],
  });
}

export async function stripeWebhook(request, env) {
  assertMethod(request, 'POST');
  const config = getStoreConfig(env);
  const signature = request.headers.get('Stripe-Signature');
  if (!signature) throw new HttpError(400, 'missing_signature');
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > 1_000_000) throw new HttpError(413, 'request_too_large');

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 1_000_000) {
    throw new HttpError(413, 'request_too_large');
  }
  const stripe = createStripe(config);
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      config.stripeWebhookSecret,
      undefined,
      stripeCryptoProvider,
    );
  } catch {
    throw new HttpError(400, 'invalid_signature');
  }

  if (
    event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded'
  ) {
    return json({ received: true });
  }

  const eventSession = event.data.object;
  if (event.type === 'checkout.session.completed' && eventSession.payment_status !== 'paid') {
    return json({ received: true, pending: true });
  }
  if (!validCheckoutSessionId(eventSession.id)) throw new HttpError(400, 'invalid_event');

  const paid = await loadPaidSession(stripe, eventSession.id, config);
  await ensureDeliveryEmail(env, paid, config);
  return json({ received: true, fulfilled: true });
}

export async function redeemPurchase(request, env) {
  assertMethod(request, 'POST');
  const config = getStoreConfig(env);
  assertSameOrigin(request, config.siteOrigin);
  const form = await readUrlEncodedForm(request);
  const token = form.get('token');
  const payload = await verifyToken(token, 'redeem', config.signingSecret);
  if (!validCheckoutSessionId(payload.sessionId)) throw new HttpError(401, 'invalid_access');

  const paid = await loadPaidSession(createStripe(config), payload.sessionId, config);
  await recordPurchase(env, paid, config);
  const accessToken = await signToken(entitlementPayload(payload.sessionId), config.signingSecret);
  const names = cookieNames(config.siteOrigin);
  return redirect(`${config.siteOrigin}/purchase-success`, 303, {
    'Set-Cookie': serializeCookie(
      names.entitlement,
      accessToken,
      TOKEN_LIFETIMES.entitlementSeconds,
      names.secure,
    ),
  });
}

export function protectedFormAsset(response) {
  const headers = new Headers(response.headers);
  headers.set('Referrer-Policy', 'same-origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function purchaseAccessPage(request, env) {
  assertMethod(request, 'GET');
  return protectedFormAsset(await env.ASSETS.fetch(request));
}

export async function purchaseSuccessPage(request, env) {
  assertMethod(request, 'GET');
  const config = getStoreConfig(env);
  const names = cookieNames(config.siteOrigin);
  const token = readCookie(request, names.entitlement);
  const payload = await verifyToken(token, 'entitlement', config.signingSecret);
  if (!validCheckoutSessionId(payload.sessionId)) throw new HttpError(401, 'invalid_access');

  await loadPaidSession(createStripe(config), payload.sessionId, config);
  return protectedFormAsset(await env.ASSETS.fetch(request));
}

export async function downloadSample(request, env, ctx) {
  assertMethod(request, 'POST');
  const config = getStoreConfig(env);
  assertSameOrigin(request, config.siteOrigin);
  const names = cookieNames(config.siteOrigin);
  const token = readCookie(request, names.entitlement);
  const payload = await verifyToken(token, 'entitlement', config.signingSecret);
  if (!validCheckoutSessionId(payload.sessionId)) throw new HttpError(401, 'invalid_access');

  await loadPaidSession(createStripe(config), payload.sessionId, config);
  const { object, bytes } = await loadVerifiedArtifact(env, config);

  ctx.waitUntil(recordDownload(env, payload.sessionId).catch(() => undefined));
  const headers = new Headers({
    ...NO_STORE_HEADERS,
    'Content-Type': 'application/gzip',
    'Content-Disposition': `attachment; filename="${PRODUCT.archiveFilename}"`,
    'Content-Length': String(object.size),
    'Accept-Ranges': 'none',
    Digest: `sha-256=${hexToBase64(config.artifactSha256)}`,
    'X-Artifact-SHA256': config.artifactSha256,
  });
  if (object.httpEtag) headers.set('ETag', object.httpEtag);
  return new Response(bytes, { status: 200, headers });
}

export function apiNotFound() {
  return json({ error: 'not_found' }, 404);
}

export function publicErrorResponse(request, env, error) {
  const path = new URL(request.url).pathname;
  const configError = error?.name === 'ConfigError';
  const status = error instanceof HttpError ? error.status : configError ? 503 : 500;
  const publicCode = safeErrorCode(error);

  if (path === '/api/stripe-webhook') {
    return json({ error: publicCode }, status);
  }
  if (path === '/api/store-status') {
    return json({ available: false }, status);
  }
  let siteOrigin;
  try {
    siteOrigin = getSiteOrigin(env);
  } catch {
    return json({ error: 'store_not_configured' }, 503);
  }
  const reason = encodeURIComponent(publicCode);
  return redirect(`${siteOrigin}/purchase-error?reason=${reason}`, 303);
}
