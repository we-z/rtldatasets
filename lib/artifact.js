import { HttpError } from './http.js';

// The protected archive lives in Vercel Blob storage, not in the git repo or
// the public/ static directory — a bundled-into-the-function local file
// would go missing on every git-triggered rebuild, since the archive is
// deliberately git-ignored (see scripts/upload-vercel-artifact.mjs) and
// Vercel builds from a fresh clone. Fetching it by URL at request time keeps
// it decoupled from what commit happens to be deployed. The URL's path
// segment already embeds the artifact's own SHA-256 (see
// PRODUCT.artifactAssetPath), so it isn't practically guessable even though
// Vercel Blob serves it over a public URL; the SHA-256/byte-length check
// below is still the authoritative integrity guarantee, independent of that.
function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function artifactExists(env) {
  return typeof env.SAMPLE_ARTIFACT_BLOB_URL === 'string' && env.SAMPLE_ARTIFACT_BLOB_URL.trim() !== '';
}

export async function loadVerifiedArtifact(config, env) {
  const blobUrl = env.SAMPLE_ARTIFACT_BLOB_URL;
  if (!blobUrl) throw new HttpError(503, 'artifact_unavailable');

  let response;
  try {
    response = await fetch(blobUrl);
  } catch {
    throw new HttpError(503, 'artifact_unavailable');
  }
  if (!response.ok) {
    throw new HttpError(503, 'artifact_unavailable');
  }

  let bytes;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
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

  return { bytes };
}
