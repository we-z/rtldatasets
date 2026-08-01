import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('sample section uses evaluation wording without an outer border', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const sample = html.slice(html.indexOf('<section id="sample"'), html.indexOf('</section>') + 10);

  assert.match(sample, /RLVR Evaluation Sample: 5 Tasks/u);
  assert.doesNotMatch(sample, /diagnostic/iu);
  assert.doesNotMatch(sample, /<section[^>]*\bborder\s*:/iu);
  assert.doesNotMatch(sample, /—/u);
});
