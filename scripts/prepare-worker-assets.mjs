import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const archive = path.resolve(process.argv[2] || '');
if (!process.argv[2]) {
  throw new Error('Usage: npm run prepare:production-assets -- /absolute/path/to/archive.tar.gz');
}

const archiveInfo = await lstat(archive);
if (!archiveInfo.isFile() || archiveInfo.isSymbolicLink()) {
  throw new Error('The release archive must be a regular, non-symlink file');
}

const config = JSON.parse(await readFile(path.join(repoRoot, 'wrangler.jsonc'), 'utf8'));
const expectedPath = config.vars?.SAMPLE_ASSET_PATH;
const expectedSha = config.vars?.SAMPLE_ARCHIVE_SHA256;
const expectedBytes = Number(config.vars?.SAMPLE_ARCHIVE_BYTES);
if (
  typeof expectedPath !== 'string' ||
  !expectedPath.startsWith('/__private/') ||
  expectedPath.includes('..') ||
  expectedPath.includes('//')
) {
  throw new Error('wrangler.jsonc does not contain a safe protected SAMPLE_ASSET_PATH');
}

const archiveBytes = await readFile(archive);
const actualSha = createHash('sha256').update(archiveBytes).digest('hex');
if (actualSha !== expectedSha || archiveBytes.byteLength !== expectedBytes) {
  throw new Error('Release archive does not match the pinned SHA-256 and byte size');
}

const assetsRoot = path.join(repoRoot, '.worker-assets');
const privateDestination = path.join(assetsRoot, expectedPath.slice(1));
if (!privateDestination.startsWith(`${assetsRoot}${path.sep}`)) {
  throw new Error('Protected asset path escapes the generated assets directory');
}

await rm(assetsRoot, { recursive: true, force: true });
await cp(path.join(repoRoot, 'public'), assetsRoot, { recursive: true });
await mkdir(path.dirname(privateDestination), { recursive: true });
await cp(archive, privateDestination, { force: false, errorOnExist: true });

process.stdout.write(`${JSON.stringify({
  prepared: true,
  assets_directory: assetsRoot,
  protected_asset_path: expectedPath,
  sha256: actualSha,
  bytes: archiveBytes.byteLength,
}, null, 2)}\n`);
