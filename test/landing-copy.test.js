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

test('the landing and supporting pages share the purchase button font', async () => {
  const [landing, supporting] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/assets/legal.css', import.meta.url), 'utf8'),
  ]);

  for (const stylesheet of [landing, supporting]) {
    assert.match(stylesheet, /font-family: Arial, Helvetica, sans-serif;/u);
    assert.match(stylesheet, /button, input, select, textarea \{ font-family: inherit; \}/u);
  }
});
