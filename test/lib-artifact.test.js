import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { artifactExists, loadVerifiedArtifact } from '../lib/artifact.js';

const content = new TextEncoder().encode('verified paid artifact');
const config = {
  artifactAssetPath: '/__private/artifacts/example.zip',
  archiveBytes: content.byteLength,
  artifactSha256: createHash('sha256').update(content).digest('hex'),
};

function withFetch(handler, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

test('artifactExists reflects whether the blob URL env var is configured', () => {
  assert.equal(artifactExists({ SAMPLE_ARTIFACT_BLOB_URL: 'https://example.com/a.zip' }), true);
  assert.equal(artifactExists({}), false);
  assert.equal(artifactExists({ SAMPLE_ARTIFACT_BLOB_URL: '' }), false);
});

test('protected asset bytes must match the pinned size and SHA-256', async () => {
  const env = { SAMPLE_ARTIFACT_BLOB_URL: 'https://example.com/artifact.zip' };
  await withFetch(
    async (url) => {
      assert.equal(url, env.SAMPLE_ARTIFACT_BLOB_URL);
      return new Response(content, { status: 200 });
    },
    async () => {
      const result = await loadVerifiedArtifact(config, env);
      assert.equal(result.bytes.byteLength, content.byteLength);
    },
  );

  const tampered = new TextEncoder().encode('tampered paid artifact');
  await withFetch(
    async () => new Response(tampered, { status: 200 }),
    () => assert.rejects(
      () => loadVerifiedArtifact({ ...config, archiveBytes: tampered.byteLength }, env),
      (error) => error?.publicCode === 'artifact_integrity_failed',
    ),
  );
});

test('missing protected assets fail closed', async () => {
  await withFetch(
    async () => new Response(null, { status: 404 }),
    () => assert.rejects(
      () => loadVerifiedArtifact(config, { SAMPLE_ARTIFACT_BLOB_URL: 'https://example.com/missing.zip' }),
      (error) => error?.publicCode === 'artifact_unavailable',
    ),
  );

  await assert.rejects(
    () => loadVerifiedArtifact(config, {}),
    (error) => error?.publicCode === 'artifact_unavailable',
  );
});
