import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { loadVerifiedArtifact } from '../worker/artifact.js';

const content = new TextEncoder().encode('verified paid artifact');
const config = {
  artifactR2Key: 'artifacts/example.tar.gz',
  archiveBytes: content.byteLength,
  artifactSha256: createHash('sha256').update(content).digest('hex'),
};

function environment(bytes = content) {
  return {
    PRODUCTS: {
      async get(key) {
        assert.equal(key, config.artifactR2Key);
        return {
          size: bytes.byteLength,
          async arrayBuffer() {
            return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          },
        };
      },
    },
  };
}

test('R2 artifact bytes must match the pinned size and SHA-256', async () => {
  const result = await loadVerifiedArtifact(environment(), config);
  assert.equal(result.bytes.byteLength, content.byteLength);

  const tampered = new TextEncoder().encode('tampered paid artifact');
  await assert.rejects(
    () => loadVerifiedArtifact(environment(tampered), { ...config, archiveBytes: tampered.byteLength }),
    (error) => error?.publicCode === 'artifact_integrity_failed',
  );
});

test('missing R2 artifacts fail closed', async () => {
  await assert.rejects(
    () => loadVerifiedArtifact({ PRODUCTS: { get: async () => null } }, config),
    (error) => error?.publicCode === 'artifact_unavailable',
  );
});
