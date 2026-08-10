import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the static site sets a strict, self-only Content-Security-Policy', async () => {
  const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.match(headers, /script-src 'self';/u);
  assert.doesNotMatch(headers, /script-src[^;]*(?:'unsafe-inline'|\*)/u);
  assert.doesNotMatch(headers, /form-action[^\n]*\*/u);
  assert.match(headers, /^  Referrer-Policy: same-origin$/mu);
  assert.match(headers, /^  X-Frame-Options: DENY$/mu);
});
