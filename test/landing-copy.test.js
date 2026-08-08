import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const termsSha256 = 'ed1d379b4c9d94aa5aa1ad40a7be813bb30be3567c5404170a455eabcd95f795';
const orderBindingSha256 = '868f52938aaca2f4a97173479bae1cde576e4aca694f4966e74abef3458698b0';
const archiveFilename = 'soc-dv-gpt-5.6-luna-customer-package-v2.0.0.zip';

test('the standalone sample page preserves the complete purchase flow', async () => {
  const sample = await readFile(new URL('../public/sample.html', import.meta.url), 'utf8');

  assert.match(sample, /RLVR Diagnostic Sample: 5 Tasks/u);
  assert.doesNotMatch(sample, /RLVR Evaluation Sample: 5 Tasks/u);
  assert.match(sample, /Artifact version 2\.0\.0/u);
  assert.match(sample, new RegExp(archiveFilename.replaceAll('.', '\\.'), 'u'));
  assert.doesNotMatch(sample, /\bMIT\b|Apache(?: License)?[- ]?2\.0/iu);
  assert.doesNotMatch(sample, /—/u);
  assert.doesNotMatch(sample, /box-shadow|#533afd|#4032c8|#b9b9f9|#2e2b8c/iu);
  assert.match(sample, /<link rel="canonical" href="https:\/\/www\.rtltasks\.com\/sample">/u);
  assert.match(sample, /<main id="sample"[^>]*aria-labelledby="sample-title">/u);
  assert.match(sample, /id="sample-checkout-form"/u);
  assert.match(sample, /id="checkout-attempt-id"/u);
  assert.match(sample, /name="terms_version" value="1\.1\.0"/u);
  assert.match(sample, new RegExp(`name="terms_sha256" value="${termsSha256}"`, 'u'));
  assert.match(sample, /name="order_binding_version" value="1\.0\.1"/u);
  assert.match(sample, new RegExp(`name="order_binding_sha256" value="${orderBindingSha256}"`, 'u'));
  assert.match(sample, /id="purchase-button"/u);
  assert.match(sample, /id="store-status" aria-live="polite"/u);
  assert.match(sample, /fieldset \{ border: 1px solid #777; border-radius: 14px;/u);
  assert.match(sample, /#purchase-button \{ width: 100%;[^}]*border-radius: 8px;/u);
  assert.match(sample, /#purchase-button:disabled \{[^}]*cursor: not-allowed;[^}]*opacity: 1;/u);
  assert.match(sample, /href="\/sample-license\.html(?:#[a-z-]+)?"/u);
  assert.match(sample, /href="\/refund-policy\.html"/u);
  assert.match(sample, /href="\/privacy\.html"/u);
  assert.match(sample, /<script src="\/assets\/checkout\.js"><\/script>/u);
});

test('public terms expose both exact versioned documents for review and download', async () => {
  const [termsPage, license, orderBinding] = await Promise.all([
    readFile(new URL('../public/sample-license.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/legal/SAMPLE_LICENSE-v1.1.0.md', import.meta.url)),
    readFile(new URL('../public/legal/TERMS_AND_ORDER_BINDING-v1.0.1.md', import.meta.url)),
  ]);

  assert.equal(createHash('sha256').update(license).digest('hex'), termsSha256);
  assert.equal(createHash('sha256').update(orderBinding).digest('hex'), orderBindingSha256);
  assert.match(termsPage, /Sample license and limitations/u);
  assert.match(termsPage, /Terms, parties, and order binding/u);
  assert.match(termsPage, new RegExp(termsSha256, 'u'));
  assert.match(termsPage, new RegExp(orderBindingSha256, 'u'));
  assert.match(termsPage, /href="\/legal\/SAMPLE_LICENSE-v1\.1\.0\.md"/u);
  assert.match(termsPage, /href="\/legal\/TERMS_AND_ORDER_BINDING-v1\.0\.1\.md"/u);
  assert.match(termsPage, /Originality/u);
  assert.match(termsPage, /Contracting parties/u);
  assert.match(termsPage, /Required assent evidence/u);
});

test('checkout binds one exact value for both documents into Stripe metadata', async () => {
  const [sample, checkout] = await Promise.all([
    readFile(new URL('../public/sample.html', import.meta.url), 'utf8'),
    readFile(new URL('../worker/checkout.js', import.meta.url), 'utf8'),
  ]);

  for (const name of [
    'terms_accepted',
    'terms_version',
    'terms_sha256',
    'order_binding_version',
    'order_binding_sha256',
  ]) {
    assert.match(checkout, new RegExp(`exactFormValue\\(form, '${name}'`, 'u'));
  }
  assert.match(checkout, /const values = form\.getAll\(name\);/u);
  assert.match(checkout, /values\.length === 1 && values\[0\] === expected/u);
  for (const field of [
    'package_id',
    'artifact_version',
    'artifact_sha256',
    'artifact_asset_path',
    'archive_filename',
    'archive_bytes',
    'terms_version',
    'terms_sha256',
    'order_binding_version',
    'order_binding_sha256',
    'terms_accepted_at',
    'terms_acceptance_method',
  ]) {
    assert.match(checkout, new RegExp(`${field}:`, 'u'));
  }
  assert.match(checkout, /\n\s+metadata,\n\s+payment_intent_data:/u);
  assert.match(checkout, /payment_intent_data: \{[\s\S]*metadata,/u);
  assert.match(checkout, /name_collection: \{/u);
  assert.match(checkout, /individual: \{ enabled: true, optional: false \}/u);
  assert.match(checkout, /business: \{ enabled: true, optional: true \}/u);
  assert.match(sample, /I have reviewed and accept both/u);
  assert.match(sample, /Sample License and Limitations[^<]*(?:version|v) 1\.1\.0/iu);
  assert.match(sample, /Terms, Parties, and Order Binding[^<]*(?:version|v) 1\.0\.1/iu);
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

test('the landing page highlights the three strongest scale claims', async () => {
  const landing = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

  assert.match(landing, /<li><strong>50,000\+<\/strong> code bases<\/li>/u);
  assert.match(landing, /<li><strong>10,000,000\+<\/strong> raw code files<\/li>/u);
  assert.match(landing, /<li><strong>100,000\+<\/strong> RLVR tasks that hill climb<\/li>/u);
  assert.doesNotMatch(landing, /verified RTL tasks that hill climb/u);
  assert.doesNotMatch(landing, /100,000,000,000\+|<strong>[^<]*<\/strong> tokens/u);
  assert.ok(landing.indexOf('100,000+</strong> RLVR tasks') < landing.indexOf('50,000+</strong> code bases'));
  assert.ok(landing.indexOf('50,000+</strong> code bases') < landing.indexOf('10,000,000+</strong> raw code files'));
});

test('the landing page publishes social sharing and favicon artwork', async () => {
  const [landing, openGraphImage, favicon] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/assets/rtl-tasks-og.png', import.meta.url)),
    readFile(new URL('../public/favicon-32x32.png', import.meta.url)),
  ]);

  assert.match(landing, /<meta property="og:image" content="https:\/\/www\.rtltasks\.com\/assets\/rtl-tasks-og\.png">/u);
  assert.match(landing, /<meta name="twitter:card" content="summary_large_image">/u);
  assert.match(landing, /<link rel="icon" href="\/favicon\.ico" sizes="any">/u);
  assert.match(landing, /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png">/u);
  assert.equal(openGraphImage.readUInt32BE(16), 1200);
  assert.equal(openGraphImage.readUInt32BE(20), 630);
  assert.equal(favicon.readUInt32BE(16), 32);
  assert.equal(favicon.readUInt32BE(20), 32);
});

test('the contact section uses simple accessible text links', async () => {
  const landing = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

  assert.equal((landing.match(/class="contact-line"/gu) || []).length, 2);
  assert.equal((landing.match(/class="contact-link"/gu) || []).length, 2);
  assert.doesNotMatch(landing, /contact-actions|contact-btn|contact-arrow/u);
  assert.match(landing, /href="mailto:root@puul\.ai\?subject=RTL%20Datasets%20request&amp;body=/u);
  assert.match(landing, /body=Hello%2C%0D%0A%0D%0AI%20would%20like%20to%20discuss%20a%20request\./u);
  assert.doesNotMatch(landing, /Hello%20RTL%20Datasets%20team/u);
  assert.match(landing, /Company%20or%20organization%3A/u);
  assert.match(landing, /Verification%20and%20tooling%3A/u);
  assert.match(landing, /Licensing%20preference%3A/u);
  assert.equal((landing.match(/href="sms:\+16508809229" class="contact-link"/gu) || []).length, 1);
  assert.match(landing, /Email: <a[^>]*class="contact-link">root@puul\.ai<\/a>/u);
  assert.match(landing, /Signal\/text: <a[^>]*class="contact-link">650-880-9229<\/a>/u);
  assert.match(landing, /\.contact \{[^}]*font-size: 1\.2rem;/u);
  assert.match(landing, /\.contact-label \{[^}]*font-size: 1\.35rem;/u);
  assert.match(landing, /\.contact-link \{ color: #111; font-weight: 400; text-decoration: underline;/u);
  assert.match(landing, /\.contact-link:focus-visible \{ outline: 2px solid #111; outline-offset: 3px;/u);
  assert.doesNotMatch(landing, /box-shadow/iu);
  assert.doesNotMatch(landing, /#533afd|#4032c8|#b9b9f9|#2e2b8c|rgba\(84, 82, 251/iu);
  assert.match(landing, /Countless more architectures available on request\./u);
  assert.equal((landing.match(/Contact us via:/gu) || []).length, 1);
  assert.match(landing, /<a href="\/sample\.html" class="purchase-sample-btn">Evaluate sample tasks<\/a>/u);
  assert.match(landing, /\.purchase-sample-btn \{[^}]*width: 100%;[^}]*margin: 3rem auto 2\.5rem;[^}]*border-radius: 8px;/u);
  assert.match(landing, /@media \(max-width: 640px\) \{[\s\S]*?\.purchase-sample-btn \{ width: 100%; max-width: none; \}/u);
  assert.ok(landing.indexOf('Contact us via:') > landing.lastIndexOf('</details>'));
  assert.ok(landing.indexOf('Diagnostic Sample') < landing.indexOf('Contact us via:'));
  assert.doesNotMatch(landing, /id="sample-checkout-form"|id="purchase-button"|\/assets\/checkout\.js/u);
  assert.doesNotMatch(landing, /—/u);
});

test('all landing content sections are closed, animated native disclosures', async () => {
  const [landing, animation] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/assets/details-animation.js', import.meta.url), 'utf8'),
  ]);

  assert.equal((landing.match(/<details class="collapsible-group">/gu) || []).length, 3);
  assert.equal((landing.match(/<details class="collapsible-group collapsible-subgroup">/gu) || []).length, 4);
  assert.equal((landing.match(/<details class="collapsible-section">/gu) || []).length, 19);
  assert.equal((landing.match(/<summary class="collapsible-summary">/gu) || []).length, 26);
  assert.equal((landing.match(/class="section-chevron" aria-hidden="true"/gu) || []).length, 26);
  assert.doesNotMatch(landing, /<details[^>]*\sopen(?:\s|=|>)/iu);
  assert.match(landing, /\.collapsible-summary \{[^}]*min-height: 44px;[^}]*cursor: pointer;/u);
  assert.match(landing, /\.collapsible-summary \{[^}]*background: transparent;[^}]*-webkit-tap-highlight-color: transparent;/u);
  assert.match(landing, /\.collapsible-summary:active \{ background: transparent; \}/u);
  assert.match(landing, /\.collapsible-summary::-webkit-details-marker \{ display: none; \}/u);
  assert.match(landing, /\.collapsible-summary:focus-visible \{ outline: 2px solid #111; outline-offset: 4px; \}/u);
  assert.match(landing, /\.section-chevron \{[^}]*transform: rotate\(-45deg\);[^}]*transition: transform 180ms ease;/u);
  assert.match(landing, /details\[open\] > \.collapsible-summary > \.section-chevron \{ transform: rotate\(45deg\); \}/u);
  assert.match(landing, /\.collapsible-group, \.collapsible-section \{ display: flow-root; \}/u);
  assert.match(landing, /\.collapsible-group\.is-animating, \.collapsible-section\.is-animating \{ overflow: hidden; will-change: height; transition: height var\(--details-duration, 320ms\) cubic-bezier\(0\.25, 1, 0\.5, 1\); \}/u);
  assert.match(landing, /details\.is-closing > \.collapsible-summary > \.section-chevron \{ transform: rotate\(-45deg\); \}/u);
  assert.match(landing, /\.collapsible-section\.is-opening > \.faq-answer \{ animation: disclosure-content-in/u);
  assert.match(landing, /\.collapsible-section\.is-closing > \.faq-answer \{ animation: disclosure-content-out/u);
  assert.match(landing, /\.subgroup-title \{ font-size: 1\.5rem; font-weight: 300;/u);
  assert.match(landing, /\.collapsible-subgroup > \.subgroup-content \{ padding: 0\.25rem 0 0\.25rem 1\.25rem; \}/u);
  assert.match(landing, /\.collapsible-subgroup \.section-title \{ font-size: 1\.35rem; \}/u);
  assert.match(landing, /@keyframes disclosure-content-in \{[^}]*opacity: 0; transform: translateY\(-0\.5rem\);/su);
  assert.match(landing, /@keyframes disclosure-content-out \{[^}]*opacity: 1; transform: translateY\(0\);/su);
  assert.equal((landing.match(/<script src="\/assets\/details-animation\.js" defer><\/script>/gu) || []).length, 1);
  assert.doesNotMatch(landing, /::details-content|interpolate-size/iu);

  assert.match(animation, /details\.collapsible-group, details\.collapsible-section/u);
  assert.match(animation, /prefers-reduced-motion: reduce/u);
  assert.match(animation, /event\.preventDefault\(\)/u);
  assert.match(animation, /getBoundingClientRect\(\)\.height/u);
  assert.match(animation, /this\.details\.scrollHeight/u);
  assert.match(animation, /requestAnimationFrame\(/u);
  assert.match(animation, /transitionend/u);
  assert.match(animation, /this\.animating \? !this\.desiredOpen : !this\.details\.open/u);
  assert.match(animation, /settleAnimatingAncestors\(\)/u);
  assert.match(animation, /settleAnimatingDescendants\(\)/u);
  assert.match(animation, /cancelAnimationFrame\(this\.frame\)/u);
  assert.match(animation, /typeof reduceMotion\.addEventListener === 'function'/u);
  assert.match(animation, /typeof reduceMotion\.addListener === 'function'/u);
  assert.doesNotMatch(animation, /\?\./u);
  assert.doesNotMatch(animation, /\.animate\(/u);
  assert.doesNotMatch(animation, /fetch\(|import\(|eval\(|new Function/iu);

  for (const heading of [
    'RTL by Chip Type',
    'Training AI on chip design',
    'FAQ',
  ]) {
    assert.match(landing, new RegExp(`<h2[^>]*>${heading}<\\/h2>`, 'u'));
  }
  for (const heading of [
    'AI &amp; Accelerators',
    'Processors &amp; Systems',
    'Memory',
    'Implementation Platforms',
  ]) {
    assert.match(landing, new RegExp(`<h3 class="subgroup-title">${heading}<\\/h3>`, 'u'));
  }
  for (const heading of [
    'DRAM',
    'SRAM',
    'Flash &amp; Non-Volatile Memory',
    'Specialized Memory',
  ]) {
    assert.match(landing, new RegExp(`<h4 class="section-title">${heading}<\\/h4>`, 'u'));
  }
  assert.match(landing, /<strong>DDR &amp; LPDDR controllers<\/strong>/u);
  assert.match(landing, /<strong>Single-port &amp; dual-port memories<\/strong>/u);
  assert.match(landing, /<strong>NOR &amp; NAND flash controllers<\/strong>/u);
  assert.match(landing, /<strong>HBM subsystems<\/strong>/u);
  assert.ok(landing.indexOf('>AI &amp; Accelerators</h3>') < landing.indexOf('>TPU</h4>'));
  assert.ok(landing.indexOf('>TPU</h4>') < landing.indexOf('>GPU</h4>'));
  assert.ok(landing.indexOf('>GPU</h4>') < landing.indexOf('>NPU</h4>'));
  assert.ok(landing.indexOf('>NPU</h4>') < landing.indexOf('>DPU</h4>'));
  assert.ok(landing.indexOf('>DPU</h4>') < landing.indexOf('>Processors &amp; Systems</h3>'));
  assert.ok(landing.indexOf('>Processors &amp; Systems</h3>') < landing.indexOf('>CPU</h4>'));
  assert.ok(landing.indexOf('>CPU</h4>') < landing.indexOf('>MPU</h4>'));
  assert.ok(landing.indexOf('>MPU</h4>') < landing.indexOf('>MCU</h4>'));
  assert.ok(landing.indexOf('>MCU</h4>') < landing.indexOf('>SoC</h4>'));
  assert.ok(landing.indexOf('>SoC</h4>') < landing.indexOf('>Memory</h3>'));
  assert.ok(landing.indexOf('>Memory</h3>') < landing.indexOf('>DRAM</h4>'));
  assert.ok(landing.indexOf('>DRAM</h4>') < landing.indexOf('>SRAM</h4>'));
  assert.ok(landing.indexOf('>SRAM</h4>') < landing.indexOf('>Flash &amp; Non-Volatile Memory</h4>'));
  assert.ok(landing.indexOf('>Flash &amp; Non-Volatile Memory</h4>') < landing.indexOf('>Specialized Memory</h4>'));
  assert.ok(landing.indexOf('>Specialized Memory</h4>') < landing.indexOf('>Implementation Platforms</h3>'));
  assert.ok(landing.indexOf('>Implementation Platforms</h3>') < landing.indexOf('>ASIC</h4>'));
  assert.ok(landing.indexOf('>ASIC</h4>') < landing.indexOf('>FPGA</h4>'));
  assert.doesNotMatch(landing, /id="waveform-title"|>Waveform &amp; Signal Processing<|>Oscilloscopes<|>ADC<|>DAC<|>DDS &amp; Waveform Generation<|>Simulation &amp; Waveform Tooling</u);
  assert.doesNotMatch(landing, />For training AI on chip design</u);
  assert.match(landing, /<h3 class="section-title">Where is the data from\?<\/h3>[\s\S]*<p class="faq-answer">Our packages combine licensed third-party RTL with operator-authored task adaptations, synthetic transformations, verification assets, evaluation metadata, diagnostic evidence, and curation\. Applicable open-source rights and notices remain intact; proprietary claims apply only to operator-authored materials and the curated compilation\. Every RLVR task is validated with EDA tools through compilation, simulation, and synthesis checks before it is included\.<\/p>/u);
  assert.doesNotMatch(landing, /Is your data synthetic\?|Where is your data from\?/u);
  assert.match(landing, /<h3 class="section-title">What do your licenses cover\?<\/h3>[\s\S]*<p class="faq-answer">Exclusive and non-exclusive licenses cover our compiled dataset packages, verification artifacts, manifests, and curation methodology, not third-party rights\.<\/p>/u);
  assert.match(landing, /<h3 class="section-title">Who owns trained models and outputs\?<\/h3>[\s\S]*<p class="faq-answer">You retain ownership of the trained models and outputs you create using our data\.<\/p>/u);
  assert.equal((landing.match(/Our packages combine licensed third-party RTL with operator-authored task adaptations, synthetic transformations, verification assets, evaluation metadata, diagnostic evidence, and curation\. Applicable open-source rights and notices remain intact; proprietary claims apply only to operator-authored materials and the curated compilation\. Every RLVR task is validated with EDA tools through compilation, simulation, and synthesis checks before it is included\./gu) || []).length, 1);
  assert.doesNotMatch(landing, /fully synthetic, novel, and proprietary/iu);
  assert.equal((landing.match(/Exclusive and non-exclusive licenses cover our compiled dataset packages, verification artifacts, manifests, and curation methodology, not third-party rights\./gu) || []).length, 1);
  assert.equal((landing.match(/You retain ownership of the trained models and outputs you create using our data\./gu) || []).length, 1);
  assert.ok(landing.indexOf('id="training-title"') < landing.indexOf('id="chip-type-title"'));
  assert.ok(landing.indexOf('id="chip-type-title"') < landing.indexOf('id="faq-title"'));
  assert.ok(landing.indexOf('Countless more architectures available on request.') > landing.indexOf('id="chip-type-title"'));
  assert.ok(landing.indexOf('Countless more architectures available on request.') < landing.indexOf('id="faq-title"'));
  assert.ok(landing.indexOf('id="faq-title"') < landing.indexOf('Evaluate sample tasks'));
});

test('the protected fulfillment page names the current Diagnostic Sample ZIP', async () => {
  const success = await readFile(
    new URL('../public/purchase-success.html', import.meta.url),
    'utf8',
  );
  assert.match(success, /Diagnostic Sample/u);
  assert.doesNotMatch(success, /Evaluation Sample/u);
  assert.match(success, /artifact version 2\.0\.0/iu);
  assert.match(success, new RegExp(archiveFilename.replaceAll('.', '\\.'), 'u'));
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
    assert.match(page, /href="\/sample\.html"/u);
    assert.doesNotMatch(page, /href="\/#sample"/u);
  }
  assert.match(refunds, /revisiting the sample purchase page/u);
});
