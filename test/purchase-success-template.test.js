import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the Vercel function template stays byte-identical to the Cloudflare-served copy', async () => {
  const [cloudflareCopy, vercelCopy] = await Promise.all([
    readFile(new URL('../public/purchase-success.html', import.meta.url)),
    readFile(new URL('../templates/purchase-success.html', import.meta.url)),
  ]);
  assert.ok(
    cloudflareCopy.equals(vercelCopy),
    'templates/purchase-success.html has drifted from public/purchase-success.html — update both together (public/ is excluded from the Vercel static deploy via .vercelignore so it is never served unguarded; api/purchase-success-page.js reads only templates/).',
  );
});
