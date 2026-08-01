import { PRODUCT, TOKEN_LIFETIMES } from './product.js';
import { getSiteOrigin, getStoreAvailability, getStoreConfig } from './config.js';
import { createStripe, stripeCryptoProvider } from './stripe.js';
import { loadPaidSession, validateBrowserRecovery } from './entitlement.js';
import { findRecoverablePurchase, recordDownload, recordPurchase } from './database.js';
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
  checkoutCookieName,
  cookieNames,
  entitlementPayload,
  readCookie,
  recentAttemptsContain,
  serializeCookie,
  signToken,
  validAttemptId,
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
  const { available } = getStoreAvailability(env);
  return json({
    available,
    product: PRODUCT.name,
  });
}

export async function checkoutSuccess(request, env) {
  assertMethod(request, 'POST');
  const config = getStoreConfig(env);
  assertSameOrigin(request, config.siteOrigin);
  const form = await readUrlEncodedForm(request);
  const sessionId = form.get('session_id');
  if (!validCheckoutSessionId(sessionId)) throw new HttpError(400, 'invalid_purchase');

  const rateKey = request.headers.get('CF-Connecting-IP') || 'unknown-client';
  const rate = await env.CHECKOUT_RATE_LIMITER.limit({ key: `complete:${rateKey}` });
  if (!rate.success) throw new HttpError(429, 'completion_rate_limited');

  const stripe = createStripe(config);
  const paid = await loadPaidSession(stripe, sessionId, config);
  const attemptId = paid.session.client_reference_id;
  if (!validAttemptId(attemptId)) throw new HttpError(403, 'invalid_purchase');
  const names = cookieNames(config.siteOrigin);
  const checkoutCookie = checkoutCookieName(config.siteOrigin, attemptId);
  const stateToken = readCookie(request, checkoutCookie);
  const browserAttempts = form.getAll('attempt_id');
  let signedAttemptMatches = false;
  if (stateToken) {
    try {
      const state = await verifyToken(stateToken, 'checkout', config.signingSecret);
      signedAttemptMatches = attemptId === state.attemptId;
    } catch {
      signedAttemptMatches = false;
    }
  }
  const browserAttemptMatches = recentAttemptsContain(browserAttempts, attemptId);
  if (!signedAttemptMatches && !browserAttemptMatches) {
    throw new HttpError(403, 'invalid_purchase');
  }
  if (!signedAttemptMatches) {
    validateBrowserRecovery(paid, browserAttempts);
  }

  await recordPurchase(env, paid, config);

  const accessToken = await signToken(entitlementPayload(sessionId), config.signingSecret);
  return json({
    complete: true,
    redirect: '/purchase-success',
    matchedAttemptIndex: browserAttempts.findIndex(
      (value) => value.toLowerCase() === attemptId.toLowerCase(),
    ),
  }, 200, {
    'Set-Cookie': [
      serializeCookie(
        names.entitlement,
        accessToken,
        TOKEN_LIFETIMES.entitlementSeconds,
        names.secure,
      ),
      serializeCookie(checkoutCookie, '', 0, names.secure),
    ],
  });
}

export async function recoverPurchase(request, env, dependencies = {}) {
  assertMethod(request, 'POST');
  const config = getStoreConfig(env);
  assertSameOrigin(request, config.siteOrigin);
  const form = await readUrlEncodedForm(request);
  const attemptIds = form.getAll('attempt_id');

  const rateKey = request.headers.get('CF-Connecting-IP') || 'unknown-client';
  const rate = await env.CHECKOUT_RATE_LIMITER.limit({ key: `recover:${rateKey}` });
  if (!rate.success) throw new HttpError(429, 'recovery_rate_limited');

  const findPurchase = dependencies.findRecoverablePurchase || findRecoverablePurchase;
  const candidate = await findPurchase(env, attemptIds, config.stripeLivemode);
  if (!candidate) return json({ recovered: false });

  const paid = dependencies.loadPaidSession
    ? await dependencies.loadPaidSession(candidate.checkout_session_id, config)
    : await loadPaidSession(createStripe(config), candidate.checkout_session_id, config);
  const attemptId = validateBrowserRecovery(
    paid,
    attemptIds,
    dependencies.nowSeconds?.(),
  );
  if (
    typeof candidate.checkout_attempt_id !== 'string' ||
    candidate.checkout_attempt_id.toLowerCase() !== attemptId.toLowerCase()
  ) {
    throw new HttpError(403, 'invalid_purchase');
  }
  const savePurchase = dependencies.recordPurchase || recordPurchase;
  await savePurchase(env, paid, config);

  const names = cookieNames(config.siteOrigin);
  const checkoutCookie = checkoutCookieName(config.siteOrigin, attemptId);
  const accessToken = await signToken(
    entitlementPayload(candidate.checkout_session_id),
    config.signingSecret,
  );
  return json({
    recovered: true,
    redirect: '/purchase-success',
    matchedAttemptIndex: attemptIds.findIndex(
      (value) => value.toLowerCase() === attemptId.toLowerCase(),
    ),
  }, 200, {
    'Set-Cookie': [
      serializeCookie(
        names.entitlement,
        accessToken,
        TOKEN_LIFETIMES.entitlementSeconds,
        names.secure,
      ),
      serializeCookie(checkoutCookie, '', 0, names.secure),
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
  await recordPurchase(env, paid, config);
  return json({ received: true, fulfilled: true });
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
  const { asset, bytes } = await loadVerifiedArtifact(env, config);

  ctx.waitUntil(recordDownload(env, payload.sessionId).catch(() => undefined));
  const headers = new Headers({
    ...NO_STORE_HEADERS,
    'Content-Type': 'application/gzip',
    'Content-Disposition': `attachment; filename="${PRODUCT.archiveFilename}"`,
    'Content-Length': String(config.archiveBytes),
    'Accept-Ranges': 'none',
    Digest: `sha-256=${hexToBase64(config.artifactSha256)}`,
    'X-Artifact-SHA256': config.artifactSha256,
  });
  const etag = asset.headers.get('ETag');
  if (etag) headers.set('ETag', etag);
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
  if (path === '/api/checkout-success' || path === '/api/recover-purchase') {
    return json({ error: publicCode }, status);
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
