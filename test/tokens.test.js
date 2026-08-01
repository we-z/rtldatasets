import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkoutCookieName,
  checkoutStatePayload,
  cookieNames,
  entitlementPayload,
  MAX_RECENT_ATTEMPTS,
  recentAttemptsContain,
  serializeCookie,
  signToken,
  validAttemptId,
  validCheckoutSessionId,
  verifyToken,
} from '../worker/tokens.js';

const secret = 'test-secret-that-is-at-least-thirty-two-bytes-long';

test('signed entitlement tokens round-trip', async () => {
  const payload = entitlementPayload('cs_test_1234567890abcdef', 1_000);
  const token = await signToken(payload, secret);
  const verified = await verifyToken(token, 'entitlement', secret, 1_001);
  assert.equal(verified.sessionId, 'cs_test_1234567890abcdef');
  assert.equal(verified.purpose, 'entitlement');
});

test('tampered and expired tokens fail closed', async () => {
  const payload = checkoutStatePayload('9f8c7968-5b56-4bba-8122-123456789abc', 1_000);
  const token = await signToken(payload, secret);
  const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
  await assert.rejects(() => verifyToken(tampered, 'checkout', secret, 1_001));
  await assert.rejects(() => verifyToken(token, 'checkout', secret, payload.exp));
  await assert.rejects(() => verifyToken(token, 'redeem', secret, 1_001));
});

test('identifier validators accept only expected shapes', () => {
  assert.equal(validAttemptId('9f8c7968-5b56-4bba-8122-123456789abc'), true);
  assert.equal(validAttemptId('not-a-uuid'), false);
  assert.equal(validCheckoutSessionId('cs_test_1234567890abcdef'), true);
  assert.equal(validCheckoutSessionId('pi_1234567890abcdef'), false);
});

test('production cookies use __Host, Secure, HttpOnly, and Lax', () => {
  const names = cookieNames('https://www.rtldatasets.com');
  const checkoutName = checkoutCookieName(
    'https://www.rtldatasets.com',
    '123e4567-e89b-42d3-a456-426614174000',
  );
  assert.match(checkoutName, /^__Host-rtl_checkout_[a-f0-9]{32}$/u);
  const serialized = serializeCookie(names.entitlement, 'token', 300, names.secure);
  assert.match(serialized, /Secure/u);
  assert.match(serialized, /HttpOnly/u);
  assert.match(serialized, /SameSite=Lax/u);
  assert.match(serialized, /Path=\//u);
  assert.doesNotMatch(serialized, /Domain=/u);
});

test('localhost cookies do not silently use the production name', () => {
  const names = cookieNames('http://localhost:8787');
  const checkoutName = checkoutCookieName(
    'http://localhost:8787',
    '123e4567-e89b-42d3-a456-426614174000',
  );
  assert.equal(names.secure, false);
  assert.equal(names.entitlement, 'rtl_entitlement');
  assert.doesNotMatch(checkoutName, /^__Host-/u);
  assert.doesNotMatch(serializeCookie(names.entitlement, 'token', 300, false), /Secure/u);
});

test('concurrent checkout attempts use distinct 24-hour state cookies', () => {
  const first = '123e4567-e89b-42d3-a456-426614174000';
  const second = '123e4567-e89b-42d3-b456-426614174001';
  assert.notEqual(
    checkoutCookieName('https://www.rtldatasets.com', first),
    checkoutCookieName('https://www.rtldatasets.com', second),
  );
  const payload = checkoutStatePayload(first, 1_000);
  assert.equal(payload.exp, 1_000 + (24 * 60 * 60));
});

test('same-browser recovery accepts only a bounded list of valid recent attempts', () => {
  const expected = '123e4567-e89b-42d3-a456-426614174000';
  const attempts = Array.from({ length: MAX_RECENT_ATTEMPTS }, (_, index) =>
    `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`);
  assert.equal(recentAttemptsContain([expected], expected), true);
  assert.equal(recentAttemptsContain(attempts, attempts.at(-1)), true);
  assert.equal(recentAttemptsContain(['invalid', expected], expected), false);
  assert.equal(recentAttemptsContain([...attempts, expected], expected), false);
  assert.equal(recentAttemptsContain([expected, expected], expected), false);
  assert.equal(recentAttemptsContain([], expected), false);
});
