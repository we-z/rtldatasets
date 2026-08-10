import { get } from '@vercel/blob';
import { HttpError } from './http.js';

// The protected archive lives in a *private* Vercel Blob store (not
// publicly reachable at all — every read is an authenticated request using
// BLOB_READ_WRITE_TOKEN), fetched by pathname at request time. This is
// decoupled from git/deploys entirely: a bundled-into-the-function local
// file would go missing on every git-triggered rebuild, since the archive
// is deliberately git-ignored (see scripts/upload-vercel-artifact.mjs) and
// Vercel builds from a fresh clone.
function blobPathname(config) {
  return config.artifactAssetPath.replace(/^\/__private\//, '');
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function artifactExists(env) {
  return typeof env.BLOB_READ_WRITE_TOKEN === 'string' && env.BLOB_READ_WRITE_TOKEN.trim() !== '';
}

export async function loadVerifiedArtifact(config, env, dependencies = {}) {
  if (!artifactExists(env)) throw new HttpError(503, 'artifact_unavailable');
  const getBlob = dependencies.get || get;

  let result;
  try {
    result = await getBlob(blobPathname(config), {
      access: 'private',
      token: env.BLOB_READ_WRITE_TOKEN,
    });
  } catch {
    throw new HttpError(503, 'artifact_unavailable');
  }
  if (!result?.stream) throw new HttpError(503, 'artifact_unavailable');

  let bytes;
  try {
    bytes = new Uint8Array(await new Response(result.stream).arrayBuffer());
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
