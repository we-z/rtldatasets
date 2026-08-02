import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the standalone sample page preserves the complete purchase flow', async () => {
  const sample = await readFile(new URL('../public/sample.html', import.meta.url), 'utf8');

  assert.match(sample, /RLVR Evaluation Sample: 5 Tasks/u);
  assert.doesNotMatch(sample, /diagnostic/iu);
  assert.doesNotMatch(sample, /\bMIT\b|Apache(?: License)?[- ]?2\.0/iu);
  assert.doesNotMatch(sample, /—/u);
  assert.doesNotMatch(sample, /box-shadow|#533afd|#4032c8|#b9b9f9|#2e2b8c/iu);
  assert.match(sample, /<link rel="canonical" href="https:\/\/www\.rtldatasets\.com\/sample">/u);
  assert.match(sample, /<main id="sample"[^>]*aria-labelledby="sample-title">/u);
  assert.match(sample, /id="sample-checkout-form"/u);
  assert.match(sample, /id="checkout-attempt-id"/u);
  assert.match(sample, /id="purchase-button"/u);
  assert.match(sample, /id="store-status" aria-live="polite"/u);
  assert.match(sample, /fieldset \{ border: 1px solid #777; border-radius: 14px;/u);
  assert.match(sample, /#purchase-button \{ width: 100%;[^}]*border-radius: 8px;/u);
  assert.match(sample, /#purchase-button:disabled \{[^}]*cursor: not-allowed;[^}]*opacity: 1;/u);
  assert.match(sample, /href="\/sample-license"/u);
  assert.match(sample, /href="\/refund-policy"/u);
  assert.match(sample, /href="\/privacy"/u);
  assert.match(sample, /<script src="\/assets\/checkout\.js"><\/script>/u);
});

test('public sample terms do not name third-party licenses', async () => {
  const terms = await readFile(new URL('../public/sample-license.html', import.meta.url), 'utf8');

  assert.doesNotMatch(terms, /\bMIT\b|Apache(?: License)?[- ]?2\.0/iu);
});

test('the landing and sample pages use Stripe marketing typography while supporting pages retain the Checkout stack', async () => {
  const [landing, sample, supporting] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/sample.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/assets/legal.css', import.meta.url), 'utf8'),
  ]);

  for (const page of [landing, sample]) {
    assert.match(page, /font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif; font-weight: 300;/u);
  }
  assert.match(landing, /h1 \{[^}]*font-weight: 300;[^}]*letter-spacing: -0\.02em;[^}]*line-height: 1\.08;/u);
  assert.match(landing, /p \{[^}]*line-height: 1\.4;/u);
  assert.match(landing, /strong \{ font-weight: 400; \}/u);
  assert.match(supporting, /font-family: -apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif;/u);

  for (const stylesheet of [landing, sample, supporting]) {
    assert.match(stylesheet, /button, input, select, textarea \{ font-family: inherit;/u);
  }
});

test('the contact section uses accessible black primary and neutral secondary actions', async () => {
  const landing = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

  assert.equal((landing.match(/class="contact-actions"/gu) || []).length, 1);
  assert.equal((landing.match(/class="contact-btn contact-btn--primary"/gu) || []).length, 1);
  assert.equal((landing.match(/class="contact-btn contact-btn--secondary"/gu) || []).length, 1);
  assert.doesNotMatch(landing, /contact-arrow/u);
  assert.match(landing, /href="mailto:root@puul\.ai\?subject=RTL%20Datasets%20request&amp;body=/u);
  assert.match(landing, /body=Hello%2C%0D%0A%0D%0AI%20would%20like%20to%20discuss%20a%20request\./u);
  assert.doesNotMatch(landing, /Hello%20RTL%20Datasets%20team/u);
  assert.match(landing, /Company%20or%20organization%3A/u);
  assert.match(landing, /Verification%20and%20tooling%3A/u);
  assert.match(landing, /Licensing%20preference%3A/u);
  assert.equal((landing.match(/href="sms:\+16508809229" class="contact-btn contact-btn--secondary"/gu) || []).length, 1);
  assert.match(landing, /\.contact-label \{[^}]*font-size: 1\.35rem;/u);
  assert.match(landing, /\.contact-btn \{[^}]*min-height: 46px;[^}]*border-radius: 8px;[^}]*font-size: 1\.05rem;/u);
  assert.match(landing, /\.contact-btn--primary \{ color: #fff; background: #000; \}/u);
  assert.match(landing, /\.contact-btn--secondary \{ color: #111; background: #fff; border-color: #c9c9c9; \}/u);
  assert.match(landing, /\.contact-btn:focus-visible \{ outline: 3px solid #111; outline-offset: 3px; \}/u);
  assert.doesNotMatch(landing, /box-shadow/iu);
  assert.doesNotMatch(landing, /#533afd|#4032c8|#b9b9f9|#2e2b8c|rgba\(84, 82, 251/iu);
  assert.match(landing, /@media \(max-width: 640px\)/u);
  assert.match(landing, /\.contact-actions \{ align-items: flex-start; flex-direction: column; \}/u);
  assert.match(landing, /\.contact-btn \{ width: auto; max-width: 100%; \}/u);
  assert.match(landing, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(landing, /Countless more architectures available on request\./u);
  assert.equal((landing.match(/Contact us via:/gu) || []).length, 1);
  assert.match(landing, /<a href="\/sample" class="purchase-sample-btn">See Eval sample tasks<\/a>/u);
  assert.match(landing, /\.purchase-sample-btn \{[^}]*width: auto;[^}]*border-radius: 8px;/u);
  assert.ok(landing.indexOf('Contact us via:') > landing.lastIndexOf('</details>'));
  assert.ok(landing.indexOf('See Eval sample tasks') < landing.indexOf('Contact us via:'));
  assert.doesNotMatch(landing, /id="sample-checkout-form"|id="purchase-button"|\/assets\/checkout\.js/u);
  assert.doesNotMatch(landing, /—/u);
});

test('all landing content sections are closed disclosures with responsive chevrons', async () => {
  const landing = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

  assert.equal((landing.match(/<details class="collapsible-group">/gu) || []).length, 3);
  assert.equal((landing.match(/<details class="collapsible-section">/gu) || []).length, 17);
  assert.equal((landing.match(/<summary class="collapsible-summary">/gu) || []).length, 20);
  assert.equal((landing.match(/class="section-chevron" aria-hidden="true"/gu) || []).length, 20);
  assert.doesNotMatch(landing, /<details[^>]*\sopen(?:\s|=|>)/iu);
  assert.match(landing, /\.collapsible-summary \{[^}]*min-height: 44px;[^}]*cursor: pointer;/u);
  assert.match(landing, /\.collapsible-summary::-webkit-details-marker \{ display: none; \}/u);
  assert.match(landing, /\.collapsible-summary:focus-visible \{ outline: 2px solid #111; outline-offset: 4px; \}/u);
  assert.match(landing, /\.section-chevron \{[^}]*transform: rotate\(-45deg\);[^}]*transition: transform 180ms ease;/u);
  assert.match(landing, /details\[open\] > \.collapsible-summary > \.section-chevron \{ transform: rotate\(45deg\); \}/u);
  assert.match(landing, /@supports \(interpolate-size: allow-keywords\) and selector\(details::details-content\)/u);
  assert.match(landing, /\.content \{ interpolate-size: allow-keywords; \}/u);
  assert.match(landing, /\.collapsible-group::details-content, \.collapsible-section::details-content \{ height: 0; overflow: clip; opacity: 0;[^}]*content-visibility 280ms allow-discrete;/u);
  assert.match(landing, /\.collapsible-group\[open\]::details-content, \.collapsible-section\[open\]::details-content \{ height: auto; opacity: 1; \}/u);
  assert.match(landing, /\.section-chevron, \.collapsible-group::details-content, \.collapsible-section::details-content, \.purchase-sample-btn \{ transition: none; \}/u);

  for (const heading of [
    'RTL by Chip Type',
    'Waveform &amp; Signal Processing',
    'For training AI on chip design',
  ]) {
    assert.match(landing, new RegExp(`<h2[^>]*>${heading}<\\/h2>`, 'u'));
  }
});

test('sample navigation and canceled checkout returns use the standalone page', async () => {
  const [checkout, headers, terms, refunds, error, privacy] = await Promise.all([
    readFile(new URL('../worker/checkout.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/_headers', import.meta.url), 'utf8'),
    readFile(new URL('../public/sample-license.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/refund-policy.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/purchase-error.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/privacy.html', import.meta.url), 'utf8'),
  ]);

  assert.match(checkout, /cancel_url: `\$\{config\.siteOrigin\}\/sample\?checkout=cancelled`/u);
  assert.doesNotMatch(checkout, /\?checkout=cancelled#sample/u);
  assert.match(headers, /^\/sample\n  Cache-Control: private, no-store, max-age=0$/mu);
  for (const page of [terms, refunds, error, privacy]) {
    assert.match(page, /href="\/sample"/u);
    assert.doesNotMatch(page, /href="\/#sample"/u);
  }
  assert.match(refunds, /revisiting the sample purchase page/u);
});
