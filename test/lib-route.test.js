import assert from 'node:assert/strict';
import test from 'node:test';
import { createRouteHandler } from '../lib/route.js';
import { HttpError } from '../lib/http.js';

function withEnv(vars, fn) {
  const previous = {};
  for (const key of Object.keys(vars)) previous[key] = process.env[key];
  Object.assign(process.env, vars);
  return Promise.resolve(fn()).finally(() => {
    for (const key of Object.keys(vars)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
}

test('legacy puul.ai hostnames permanently redirect to the canonical storefront', async () => {
  await withEnv({ SITE_URL: 'https://www.rtltasks.com' }, async () => {
    const handler = createRouteHandler(() => {
      throw new Error('alias requests must not reach the wrapped handler');
    });

    for (const hostname of ['puul.ai', 'www.puul.ai']) {
      const response = await handler(new Request(`https://${hostname}/sample?source=legacy`));
      assert.equal(response.status, 308);
      assert.equal(
        response.headers.get('Location'),
        'https://www.rtltasks.com/sample?source=legacy',
      );
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store, max-age=0');
    }
  });
});

test('requests on the canonical origin reach the wrapped handler', async () => {
  await withEnv({ SITE_URL: 'https://www.rtltasks.com' }, async () => {
    let called = false;
    const handler = createRouteHandler(() => {
      called = true;
      return new Response('ok');
    });
    const response = await handler(new Request('https://www.rtltasks.com/api/store-status'));
    assert.equal(called, true);
    assert.equal(await response.text(), 'ok');
  });
});

test('thrown errors are converted into a safe public error response', async () => {
  await withEnv({ SITE_URL: 'https://www.rtltasks.com' }, async () => {
    const handler = createRouteHandler(() => {
      throw new HttpError(429, 'checkout_rate_limited');
    });
    const response = await handler(new Request('https://www.rtltasks.com/api/create-checkout-session', { method: 'POST' }));
    assert.equal(response.status, 303);
  });
});
