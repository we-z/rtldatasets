import { PRODUCT, TOKEN_LIFETIMES } from './product.js';
import { HttpError } from './http.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlToBytes(value) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error('Malformed base64url');
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signToken(payload, secret) {
  const encodedPayload = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    encoder.encode(encodedPayload),
  );
  return `${encodedPayload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyToken(token, expectedPurpose, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
    throw new HttpError(401, 'invalid_access');
  }
  const parts = token.split('.');
  if (parts.length !== 2) throw new HttpError(401, 'invalid_access');
  let signature;
  try {
    signature = base64UrlToBytes(parts[1]);
  } catch {
    throw new HttpError(401, 'invalid_access');
  }
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    signature,
    encoder.encode(parts[0]),
  );
  if (!valid) throw new HttpError(401, 'invalid_access');

  let payload;
  try {
    payload = JSON.parse(decoder.decode(base64UrlToBytes(parts[0])));
  } catch {
    throw new HttpError(401, 'invalid_access');
  }
  if (
    payload?.v !== 1 ||
    payload?.purpose !== expectedPurpose ||
    payload?.sku !== PRODUCT.sku ||
    !Number.isInteger(payload?.exp) ||
    payload.exp <= nowSeconds
  ) {
    throw new HttpError(401, 'invalid_access');
  }
  return payload;
}

export function validAttemptId(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

export function validCheckoutSessionId(value) {
  return typeof value === 'string' && /^cs_(?:test_|live_)?[A-Za-z0-9]{12,200}$/u.test(value);
}

export function checkoutStatePayload(attemptId, nowSeconds = Math.floor(Date.now() / 1000)) {
  return {
    v: 1,
    purpose: 'checkout',
    sku: PRODUCT.sku,
    attemptId,
    exp: nowSeconds + TOKEN_LIFETIMES.checkoutStateSeconds,
  };
}

export function entitlementPayload(sessionId, nowSeconds = Math.floor(Date.now() / 1000)) {
  return {
    v: 1,
    purpose: 'entitlement',
    sku: PRODUCT.sku,
    sessionId,
    exp: nowSeconds + TOKEN_LIFETIMES.entitlementSeconds,
  };
}

export function redeemPayload(sessionId, expiresAt) {
  return {
    v: 1,
    purpose: 'redeem',
    sku: PRODUCT.sku,
    sessionId,
    exp: expiresAt,
  };
}

export function cookieNames(siteOrigin) {
  const secure = new URL(siteOrigin).protocol === 'https:';
  return {
    secure,
    checkout: secure ? '__Host-rtl_checkout_state' : 'rtl_checkout_state',
    entitlement: secure ? '__Host-rtl_entitlement' : 'rtl_entitlement',
  };
}

export function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() === name) {
      return pair.slice(separator + 1).trim();
    }
  }
  return null;
}

export function serializeCookie(name, value, maxAgeSeconds, secure) {
  const parts = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
