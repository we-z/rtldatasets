import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const archive = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Usage: npm run upload:sample -- /absolute/path/to/archive.tar.gz');
const metadataPath = `${archive}.metadata.json`;
const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
const archiveBuffer = await readFile(archive);
const archiveSha = createHash('sha256').update(archiveBuffer).digest('hex');
const archiveInfo = await stat(archive);
if (metadata.archive_sha256 !== `sha256:${archiveSha}` || metadata.archive_bytes !== archiveInfo.size) {
  throw new Error('Local archive does not match its metadata sidecar');
}
if (!metadata.object_key.includes(`/sha256/${archiveSha}/`)) {
  throw new Error('R2 object key is not content-addressed by the archive SHA-256');
}

const bucket = 'rtldatasets-products';
const remotePath = `${bucket}/${metadata.object_key}`;
const temporary = await mkdtemp(path.join(os.tmpdir(), 'rtldatasets-r2-verify-'));
const downloaded = path.join(temporary, metadata.archive_filename);

function wrangler(args, allowFailure = false) {
  const result = spawnSync('npx', ['wrangler', ...args], {
    cwd: path.resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
    stdio: allowFailure ? 'pipe' : 'inherit',
  });
  if (!allowFailure && result.status !== 0) throw new Error(`Wrangler failed: ${args.join(' ')}`);
  return result;
}

try {
  const existing = wrangler(['r2', 'object', 'get', remotePath, '--remote', '--file', downloaded], true);
  if (existing.status === 0) throw new Error(`Refusing to overwrite existing R2 object: ${metadata.object_key}`);
  const lookupOutput = `${existing.stdout || ''}\n${existing.stderr || ''}`;
  if (!/specified key does not exist|object not found|NoSuchKey/iu.test(lookupOutput)) {
    throw new Error('Could not safely establish that the R2 object is absent');
  }

  wrangler([
    'r2', 'object', 'put', remotePath, '--remote', '--file', archive,
    '--content-type', 'application/gzip',
    '--content-disposition', `attachment; filename="${metadata.archive_filename}"`,
    '--cache-control', 'private, no-store',
  ]);
  wrangler(['r2', 'object', 'put', `${remotePath}.sha256`, '--remote', '--file', `${archive}.sha256`, '--content-type', 'text/plain']);
  wrangler(['r2', 'object', 'put', `${remotePath}.metadata.json`, '--remote', '--file', metadataPath, '--content-type', 'application/json']);
  wrangler(['r2', 'object', 'get', remotePath, '--remote', '--file', downloaded]);
  const downloadedSha = createHash('sha256').update(await readFile(downloaded)).digest('hex');
  if (downloadedSha !== archiveSha) throw new Error('Uploaded R2 object failed SHA-256 verification');
  process.stdout.write(`${JSON.stringify({ uploaded: true, bucket, key: metadata.object_key, sha256: archiveSha, bytes: archiveInfo.size }, null, 2)}\n`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
