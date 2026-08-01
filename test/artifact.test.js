import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { loadVerifiedArtifact } from '../worker/artifact.js';

const content = new TextEncoder().encode('verified paid artifact');
const config = {
  siteOrigin: 'https://www.rtldatasets.com',
  artifactAssetPath: '/__private/artifacts/example.tar.gz',
  archiveBytes: content.byteLength,
  artifactSha256: createHash('sha256').update(content).digest('hex'),
};

function environment(bytes = content) {
  return {
    ASSETS: {
      async fetch(request) {
        assert.equal(new URL(request.url).pathname, config.artifactAssetPath);
        return new Response(bytes, { headers: { ETag: '"verified-asset"' } });
      },
    },
  };
}

test('protected asset bytes must match the pinned size and SHA-256', async () => {
  const result = await loadVerifiedArtifact(environment(), config);
  assert.equal(result.bytes.byteLength, content.byteLength);
  assert.equal(result.asset.headers.get('ETag'), '"verified-asset"');

  const tampered = new TextEncoder().encode('tampered paid artifact');
  await assert.rejects(
    () => loadVerifiedArtifact(environment(tampered), { ...config, archiveBytes: tampered.byteLength }),
    (error) => error?.publicCode === 'artifact_integrity_failed',
  );
});

test('missing protected assets fail closed', async () => {
  await assert.rejects(
    () => loadVerifiedArtifact({ ASSETS: { fetch: async () => new Response(null, { status: 404 }) } }, config),
    (error) => error?.publicCode === 'artifact_unavailable',
  );
});
