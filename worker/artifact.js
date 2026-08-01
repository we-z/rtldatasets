import { HttpError } from './http.js';

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function loadVerifiedArtifact(env, config) {
  let object;
  try {
    object = await env.PRODUCTS.get(config.artifactR2Key);
  } catch {
    throw new HttpError(503, 'artifact_unavailable');
  }
  if (!object || object.size !== config.archiveBytes) {
    throw new HttpError(503, 'artifact_unavailable');
  }

  let bytes;
  try {
    bytes = await object.arrayBuffer();
  } catch {
    throw new HttpError(503, 'artifact_unavailable');
  }
  if (bytes.byteLength !== config.archiveBytes) {
    throw new HttpError(503, 'artifact_unavailable');
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  if (bytesToHex(new Uint8Array(digest)) !== config.artifactSha256) {
    throw new HttpError(503, 'artifact_integrity_failed');
  }

  return { object, bytes };
}
