import { HttpError } from './http.js';

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function loadVerifiedArtifact(env, config) {
  let asset;
  try {
    const assetUrl = new URL(config.artifactAssetPath, config.siteOrigin);
    asset = await env.ASSETS.fetch(new Request(assetUrl, { method: 'GET' }));
  } catch {
    throw new HttpError(503, 'artifact_unavailable');
  }
  if (!asset?.ok) {
    throw new HttpError(503, 'artifact_unavailable');
  }

  let bytes;
  try {
    bytes = await asset.arrayBuffer();
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

  return { asset, bytes };
}
