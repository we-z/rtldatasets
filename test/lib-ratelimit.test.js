import assert from 'node:assert/strict';
import test from 'node:test';
import { checkRateLimit } from '../lib/ratelimit.js';

test('allows up to 10 requests per key then blocks further ones in the same window', async () => {
  const env = {};
  const key = `test-key-${Math.random()}`;
  for (let index = 0; index < 10; index += 1) {
    const result = await checkRateLimit(env, 'checkout', key);
    assert.equal(result.success, true, `request ${index} should succeed`);
  }
  const blocked = await checkRateLimit(env, 'checkout', key);
  assert.equal(blocked.success, false);
});

test('buckets are independent per prefix and per key', async () => {
  const env = {};
  const key = `test-key-${Math.random()}`;
  for (let index = 0; index < 10; index += 1) {
    await checkRateLimit(env, 'complete', key);
  }
  assert.equal((await checkRateLimit(env, 'complete', key)).success, false);
  assert.equal((await checkRateLimit(env, 'checkout', key)).success, true);
  assert.equal((await checkRateLimit(env, 'complete', `${key}-other`)).success, true);
});

test('__rateLimitOverride bypasses the in-memory limiter for tests', async () => {
  const result = await checkRateLimit(
    { __rateLimitOverride: async (prefix, key) => ({ success: false, prefix, key }) },
    'checkout',
    'anything',
  );
  assert.deepEqual(result, { success: false, prefix: 'checkout', key: 'anything' });
});
