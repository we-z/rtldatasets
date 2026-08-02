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
  assert.match(sample, /<fieldset style="border: 1px solid #777; border-radius: 14px;/u);
  assert.match(sample, /id="purchase-button"[^>]*border-radius: 999px;/u);
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

test('the contact section uses accessible black primary and neutral secondary actions', async () => {
  const landing = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

  assert.equal((landing.match(/class="contact-actions"/gu) || []).length, 1);
  assert.equal((landing.match(/class="contact-btn contact-btn--primary"/gu) || []).length, 1);
  assert.equal((landing.match(/class="contact-btn contact-btn--secondary"/gu) || []).length, 1);
  assert.equal((landing.match(/class="contact-arrow" aria-hidden="true"/gu) || []).length, 2);
  assert.match(landing, /href="mailto:root@puul\.ai\?subject=RTL%20Datasets%20request&amp;body=/u);
  assert.match(landing, /Company%20or%20organization%3A/u);
  assert.match(landing, /Verification%20and%20tooling%3A/u);
  assert.match(landing, /Licensing%20preference%3A/u);
  assert.equal((landing.match(/href="sms:\+16508809229" class="contact-btn contact-btn--secondary"/gu) || []).length, 1);
  assert.match(landing, /\.contact-btn \{[^}]*border-radius: 999px;/u);
  assert.match(landing, /\.contact-btn--primary \{ color: #fff; background: #000; \}/u);
  assert.match(landing, /\.contact-btn--secondary \{ color: #111; background: #fff; border-color: #d8d8d8; \}/u);
  assert.match(landing, /\.contact-btn:focus-visible \{ outline: 3px solid #111; outline-offset: 3px; \}/u);
  assert.doesNotMatch(landing, /box-shadow/iu);
  assert.doesNotMatch(landing, /#533afd|#4032c8|#b9b9f9|#2e2b8c|rgba\(84, 82, 251/iu);
  assert.match(landing, /@media \(max-width: 640px\)/u);
  assert.match(landing, /\.contact-actions \{ align-items: flex-start; flex-direction: column; \}/u);
  assert.match(landing, /\.contact-btn \{ width: auto; max-width: 100%; min-height: 48px; \}/u);
  assert.match(landing, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(landing, /Countless more architectures available on request\./u);
  assert.equal((landing.match(/Contact us via:/gu) || []).length, 1);
  assert.doesNotMatch(landing, /—/u);
});
