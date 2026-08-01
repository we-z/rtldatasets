import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRedeemUrl } from '../worker/email.js';

test('email redemption credentials stay in the URL fragment', () => {
  const token = 'signed.payload/value';
  const url = new URL(buildRedeemUrl('https://www.rtldatasets.com', token));

  assert.equal(url.pathname, '/purchase-access');
  assert.equal(url.search, '');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('token'), token);
});
