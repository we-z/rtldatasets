import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { put } from '@vercel/blob';
import { PRODUCT } from '../lib/product.js';

const archive = process.argv[2];
if (!archive) {
  throw new Error('Usage: BLOB_READ_WRITE_TOKEN=... node scripts/upload-vercel-artifact.mjs /absolute/path/to/customer-package.zip');
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error('Set BLOB_READ_WRITE_TOKEN (from the Vercel project\'s Blob store) before running this script.');
}

const archiveInfo = await lstat(archive);
if (!archiveInfo.isFile() || archiveInfo.isSymbolicLink()) {
  throw new Error('The release archive must be a regular, non-symlink file');
}

const bytes = await readFile(archive);
const actualSha = createHash('sha256').update(bytes).digest('hex');
if (actualSha !== PRODUCT.archiveSha256 || bytes.byteLength !== PRODUCT.archiveBytes) {
  throw new Error('Release archive does not match the pinned SHA-256 and byte size in lib/product.js');
}

// pathname mirrors PRODUCT.artifactAssetPath (minus the /__private/ prefix).
// Access is private: the blob is never publicly reachable by URL at all —
// every read (lib/artifact.js) is an authenticated request using
// BLOB_READ_WRITE_TOKEN, which is already required here to upload.
const pathname = PRODUCT.artifactAssetPath.replace(/^\/__private\//, '');
const blob = await put(pathname, bytes, {
  access: 'private',
  addRandomSuffix: false,
  contentType: PRODUCT.archiveContentType,
});

process.stdout.write(`${JSON.stringify({
  uploaded: true,
  pathname: blob.pathname,
  sha256: actualSha,
  bytes: bytes.byteLength,
  next_step: 'Nothing else to configure — lib/artifact.js reads this by pathname using BLOB_READ_WRITE_TOKEN, which is already set on the Vercel project from creating the Blob store.',
}, null, 2)}\n`);
