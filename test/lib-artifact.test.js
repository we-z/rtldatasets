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
const env = { BLOB_READ_WRITE_TOKEN: 'test-token' };

function fakeBlob(bytes) {
  return async (pathname, options) => {
    assert.equal(pathname, 'artifacts/example.zip');
    assert.equal(options.access, 'private');
    assert.equal(options.token, env.BLOB_READ_WRITE_TOKEN);
    return { stream: new Response(bytes).body };
  };
}

test('artifactExists reflects whether the Blob token env var is configured', () => {
  assert.equal(artifactExists({ BLOB_READ_WRITE_TOKEN: 'token' }), true);
  assert.equal(artifactExists({}), false);
  assert.equal(artifactExists({ BLOB_READ_WRITE_TOKEN: '' }), false);
});

test('protected asset bytes must match the pinned size and SHA-256', async () => {
  const result = await loadVerifiedArtifact(config, env, { get: fakeBlob(content) });
  assert.equal(result.bytes.byteLength, content.byteLength);

  const tampered = new TextEncoder().encode('tampered paid artifact');
  await assert.rejects(
    () => loadVerifiedArtifact(
      { ...config, archiveBytes: tampered.byteLength },
      env,
      { get: fakeBlob(tampered) },
    ),
    (error) => error?.publicCode === 'artifact_integrity_failed',
  );
});

test('missing protected assets fail closed', async () => {
  await assert.rejects(
    () => loadVerifiedArtifact(config, env, { get: async () => null }),
    (error) => error?.publicCode === 'artifact_unavailable',
  );

  await assert.rejects(
    () => loadVerifiedArtifact(config, {}, { get: async () => { throw new Error('must not be called'); } }),
    (error) => error?.publicCode === 'artifact_unavailable',
  );
});
