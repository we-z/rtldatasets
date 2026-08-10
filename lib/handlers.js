import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PRODUCT, TOKEN_LIFETIMES } from './product.js';
import { getSiteOrigin, getStoreAvailability, getStoreConfig } from './config.js';
import { createStripe } from './stripe.js';
import { loadPaidSession, validateBrowserRecovery } from './entitlement.js';
import { checkRateLimit } from './ratelimit.js';
import {
  assertMethod,
  assertSameOrigin,
  clientIp,
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

export async function storeStatus(request, env) {
  assertMethod(request, 'GET');
  const { available } = getStoreAvailability(env);
  return json({
    available,
    product: PRODUCT.name,
    artifactVersion: PRODUCT.artifactVersion,
    archiveFilename: PRODUCT.archiveFilename,
  });
}

export async function checkoutSuccess(request, env) {
  assertMethod(request, 'POST');
  const config = getStoreConfig(env);
  assertSameOrigin(request, config.siteOrigin);
  const form = await readUrlEncodedForm(request);
  const sessionId = form.get('session_id');
  if (!validCheckoutSessionId(sessionId)) throw new HttpError(400, 'invalid_purchase');

  const rateKey = clientIp(request);
  const rate = await checkRateLimit(env, 'complete', rateKey);
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

  // Fulfillment is manual from here: the paid, verified session above is
  // Stripe's own durable record (visible in the Stripe Dashboard) of exactly
  // which release (PRODUCT.artifactVersion / archive filename, in session
  // metadata) was purchased. There is no order database on this deployment.
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
  try {
    // Only used to verify this really came from Stripe; there is no order
    // database to write to, so the parsed event itself is not needed.
    await stripe.webhooks.constructEventAsync(rawBody, signature, config.stripeWebhookSecret);
  } catch {
    throw new HttpError(400, 'invalid_signature');
  }
  return json({ received: true });
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
  // Read from templates/, not public/ — a copy under public/ would be
  // directly reachable at the clean URL /purchase-success (Vercel serves
  // static files ahead of vercel.json rewrites when both match the same
  // path), bypassing this handler's entitlement check entirely.
  const html = await readFile(path.join(process.cwd(), 'templates', 'purchase-success.html'));
  return protectedFormAsset(new Response(html, {
    status: 200,
    headers: { ...NO_STORE_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
  }));
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
  if (path === '/api/checkout-success') {
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
