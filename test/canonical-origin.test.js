import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker/index.js';

test('legacy puul.ai hostnames permanently redirect to the canonical storefront', async () => {
  const env = {
    SITE_URL: 'https://www.rtltasks.com',
    ASSETS: {
      async fetch() {
        throw new Error('alias requests must not reach static assets');
      },
    },
  };

  for (const hostname of ['puul.ai', 'www.puul.ai']) {
    const response = await worker.fetch(
      new Request(`https://${hostname}/sample?source=legacy`),
      env,
      {},
    );
    assert.equal(response.status, 308);
    assert.equal(
      response.headers.get('Location'),
      'https://www.rtltasks.com/sample?source=legacy',
    );
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store, max-age=0');
  }
});
