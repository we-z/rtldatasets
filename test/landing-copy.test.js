import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('sample section uses evaluation wording without an outer border', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const sample = html.slice(html.indexOf('<section id="sample"'), html.indexOf('</section>') + 10);

  assert.match(sample, /RLVR Evaluation Sample: 5 Tasks/u);
  assert.doesNotMatch(sample, /diagnostic/iu);
  assert.doesNotMatch(sample, /\bMIT\b|Apache(?: License)?[- ]?2\.0/iu);
  assert.doesNotMatch(sample, /<section[^>]*\bborder\s*:/iu);
  assert.doesNotMatch(sample, /—/u);
});

test('public sample terms do not name third-party licenses', async () => {
  const terms = await readFile(new URL('../public/sample-license.html', import.meta.url), 'utf8');

  assert.doesNotMatch(terms, /\bMIT\b|Apache(?: License)?[- ]?2\.0/iu);
});
