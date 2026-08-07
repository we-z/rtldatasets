import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker/index.js';

test('direct requests can never fall through to protected static assets', async () => {
  let assetFetches = 0;
  const response = await worker.fetch(
    new Request('https://www.rtltasks.com/__private/artifacts/example.zip'),
    {
      ASSETS: {
        async fetch() {
          assetFetches += 1;
          return new Response('secret archive');
        },
      },
    },
    { waitUntil() {} },
  );

  assert.equal(response.status, 404);
  assert.equal(assetFetches, 0);
});
