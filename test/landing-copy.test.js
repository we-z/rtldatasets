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

test('the landing page uses Stripe marketing typography while supporting pages retain the Checkout stack', async () => {
  const [landing, supporting] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/assets/legal.css', import.meta.url), 'utf8'),
  ]);

  assert.match(landing, /font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif; font-weight: 300;/u);
  assert.match(landing, /h1 \{[^}]*font-weight: 300;[^}]*letter-spacing: -0\.02em;[^}]*line-height: 1\.08;/u);
  assert.match(landing, /p \{[^}]*line-height: 1\.4;/u);
  assert.match(landing, /strong \{ font-weight: 400; \}/u);
  assert.match(supporting, /font-family: -apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif;/u);

  for (const stylesheet of [landing, supporting]) {
    assert.match(stylesheet, /button, input, select, textarea \{ font-family: inherit;/u);
  }
});
