import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const publicRoot = path.join(repoRoot, 'public');
const assetsRoot = path.join(repoRoot, '.worker-assets');
const config = JSON.parse(await readFile(path.join(repoRoot, 'wrangler.jsonc'), 'utf8'));
const privateRelative = config.vars?.SAMPLE_ASSET_PATH?.replace(/^\//u, '');
const expectedSha = config.vars?.SAMPLE_ARCHIVE_SHA256;
const expectedBytes = Number(config.vars?.SAMPLE_ARCHIVE_BYTES);

if (!privateRelative || !privateRelative.startsWith('__private/')) {
  throw new Error('Production SAMPLE_ASSET_PATH is missing or not private');
}

async function listFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) throw new Error(`Generated assets contain a symlink: ${absolute}`);
    if (entry.isDirectory()) {
      files.push(...await listFiles(root, absolute));
    } else if (entry.isFile()) {
      files.push(path.relative(root, absolute).split(path.sep).join('/'));
    } else {
      throw new Error(`Generated assets contain a non-file entry: ${absolute}`);
    }
  }
  return files.sort();
}

const publicFiles = await listFiles(publicRoot);
const generatedFiles = await listFiles(assetsRoot);
const expectedFiles = [...publicFiles, privateRelative].sort();
if (JSON.stringify(generatedFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error('Generated Worker assets are stale or contain unexpected files; run prepare:production-assets');
}

for (const relative of publicFiles) {
  const [source, generated] = await Promise.all([
    readFile(path.join(publicRoot, relative)),
    readFile(path.join(assetsRoot, relative)),
  ]);
  if (!source.equals(generated)) {
    throw new Error(`Generated Worker asset differs from public source: ${relative}`);
  }
}

const archive = await readFile(path.join(assetsRoot, privateRelative));
const actualSha = createHash('sha256').update(archive).digest('hex');
if (archive.byteLength !== expectedBytes || actualSha !== expectedSha) {
  throw new Error('Generated private archive does not match the pinned size and SHA-256');
}

process.stdout.write(`${JSON.stringify({
  verified: true,
  public_files: publicFiles.length,
  protected_asset_path: `/${privateRelative}`,
  sha256: actualSha,
  bytes: archive.byteLength,
}, null, 2)}\n`);
