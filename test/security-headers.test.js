import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { protectedFormAsset } from '../worker/handlers.js';

test('CSP permits only the fixed Stripe Checkout redirect destination', async () => {
  const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.match(
    headers,
    /form-action 'self' https:\/\/checkout\.stripe\.com;/u,
  );
  assert.match(headers, /script-src 'self';/u);
  assert.doesNotMatch(headers, /script-src[^;]*(?:'unsafe-inline'|\*)/u);
  assert.doesNotMatch(headers, /form-action[^\n]*\*/u);
});

test('pages with protected POST forms retain a same-origin Origin header', async () => {
  const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.match(headers, /^  Referrer-Policy: same-origin$/mu);
  assert.match(headers, /^\/sample\n  Cache-Control: private, no-store, max-age=0$/mu);
  assert.doesNotMatch(headers, /Referrer-Policy: no-referrer/u);
});

test('Worker-first protected form pages replace inherited referrer policies', () => {
  const upstream = new Response('form', {
    headers: { 'Referrer-Policy': 'no-referrer' },
  });
  const response = protectedFormAsset(upstream);
  assert.equal(response.headers.get('Referrer-Policy'), 'same-origin');
});
