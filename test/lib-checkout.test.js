import assert from 'node:assert/strict';
import test from 'node:test';
import { createCheckout } from '../lib/checkout.js';
import { publicErrorResponse } from '../lib/handlers.js';

test('disabled checkout fails closed before requiring production secrets', async () => {
  const request = new Request('https://www.rtltasks.com/api/create-checkout-session', {
    method: 'POST',
  });

  await assert.rejects(
    () => createCheckout(request, { STORE_LIVE: 'false' }),
    (error) => error?.status === 503 && error?.publicCode === 'store_unavailable',
  );
});

test('configuration failures produce a safe unavailable response', () => {
  const error = Object.assign(new Error('Missing STRIPE_SECRET_KEY'), { name: 'ConfigError' });
  const response = publicErrorResponse(
    new Request('https://www.rtltasks.com/api/create-checkout-session'),
    { SITE_URL: 'https://www.rtltasks.com' },
    error,
  );

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get('Location'),
    'https://www.rtltasks.com/purchase-error?reason=store_not_configured',
  );
});
