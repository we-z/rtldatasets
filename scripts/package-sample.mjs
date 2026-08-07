import { createHash } from 'node:crypto';
import {
  chmod,
  copyFile,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { create as createTar, extract as extractTar } from 'tar';

throw new Error(
  'Legacy v1.0.0 tar builder disabled: it cannot produce the pinned v1.0.2 customer ZIP. ' +
  'Build and verify the release in the SoC DV pilot workspace, then run ' +
  '`npm run prepare:production-assets -- /absolute/path/to/soc-dv-gpt-5.3-codex-spark-customer-package-v1.0.2.zip`.',
);

const PRODUCT_ID = 'soc-dv-rlvr-diagnostic-sample-5-task';
const SKU = 'SOC-DV-RLVR-DIAG-5-V1';
const VERSION = '1.0.0';
const SAMPLE_ID = 'soc-dv-gpt-5.3-codex-spark-shakedown-v1';
const ROOT_NAME = `${PRODUCT_ID}-v${VERSION}`;
const ARCHIVE_NAME = `${ROOT_NAME}.tar.gz`;
const RELEASE_EPOCH = 1_785_542_400;
const RELEASE_DATE = '2026-08-01T00:00:00Z';
const repoRoot = path.resolve(import.meta.dirname, '..');
if (!process.argv[2]) {
  throw new Error('Usage: npm run package:sample -- /absolute/path/to/sample /absolute/output/directory');
}
const source = path.resolve(process.argv[2]);
const outputDirectory = path.resolve(process.argv[3] || path.join(os.tmpdir(), 'rtltasks-release'));
const fixedDate = new Date(RELEASE_EPOCH * 1000);

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function sha256File(filename) {
  return sha256(await readFile(filename));
}

function relativePosix(root, filename) {
  return path.relative(root, filename).split(path.sep).join('/');
}

async function walk(root) {
  const output = [];
  async function visit(directory) {
    const names = await readdir(directory);
    names.sort((a, b) => Buffer.from(a).compare(Buffer.from(b)));
    for (const name of names) {
      const filename = path.join(directory, name);
      const info = await lstat(filename);
      if (info.isSymbolicLink()) throw new Error(`Symlinks are forbidden: ${filename}`);
      if (info.isDirectory()) {
        output.push({ filename, type: 'directory' });
        await visit(filename);
      } else if (info.isFile()) {
        output.push({ filename, type: 'file' });
      } else {
        throw new Error(`Unsupported filesystem entry: ${filename}`);
      }
    }
  }
  await visit(root);
  return output;
}

function forbidden(relativePath) {
  const components = relativePath.split('/');
  return components.some((component) => [
    '.git', '.DS_Store', '.pytest_cache', '__pycache__', '.build',
    'obj_dir', 'sim_build', 'node_modules',
  ].includes(component)) || relativePath.endsWith('~');
}

async function validateTree(root) {
  const entries = await walk(root);
  for (const entry of entries) {
    const relative = relativePosix(root, entry.filename);
    if (forbidden(relative)) throw new Error(`Forbidden release path: ${relative}`);
    if (entry.type !== 'file') continue;
    const buffer = await readFile(entry.filename);
    if (entry.filename.endsWith('.json')) JSON.parse(buffer.toString('utf8'));
    const text = buffer.toString('utf8');
    const secretPatterns = [
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
      /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/u,
      /\bwhsec_[A-Za-z0-9]{16,}\b/u,
      /\bAKIA[0-9A-Z]{16}\b/u,
    ];
    if (secretPatterns.some((pattern) => pattern.test(text))) {
      throw new Error(`Potential secret in release path: ${relative}`);
    }
  }
  return entries;
}

async function normalizeTree(root) {
  const entries = await walk(root);
  for (const entry of [...entries].reverse()) {
    await chmod(entry.filename, entry.type === 'directory' ? 0o755 : 0o644);
    await utimes(entry.filename, fixedDate, fixedDate);
  }
  await chmod(root, 0o755);
  await utimes(root, fixedDate, fixedDate);
}

async function writeManifest(root) {
  const entries = (await walk(root))
    .filter((entry) => entry.type === 'file' && relativePosix(root, entry.filename) !== 'MANIFEST.sha256')
    .sort((a, b) => Buffer.from(relativePosix(root, a.filename)).compare(Buffer.from(relativePosix(root, b.filename))));
  const rows = [];
  for (const entry of entries) {
    const buffer = await readFile(entry.filename);
    rows.push(`${sha256(buffer)}  ${buffer.byteLength}  ${relativePosix(root, entry.filename)}`);
  }
  const manifest = `${rows.join('\n')}\n`;
  const filename = path.join(root, 'MANIFEST.sha256');
  await writeFile(filename, manifest, { encoding: 'utf8', mode: 0o644, flag: 'wx' });
  await utimes(filename, fixedDate, fixedDate);
  return { filename, count: rows.length, sha256: sha256(Buffer.from(manifest)) };
}

async function createArchive(stagingParent, target) {
  const root = path.join(stagingParent, ROOT_NAME);
  const entries = [
    ROOT_NAME,
    ...(await walk(root)).map((entry) => `${ROOT_NAME}/${relativePosix(root, entry.filename)}`),
  ];
  await createTar({
    cwd: stagingParent,
    file: target,
    gzip: { level: 9 },
    mtime: fixedDate,
    portable: true,
    noDirRecurse: true,
    noPax: true,
    strict: true,
  }, entries);
}

async function verifyExtractedArchive(archive, expectedManifestCount, expectedManifestSha) {
  const extractionParent = await mkdtemp(path.join(os.tmpdir(), 'rtltasks-verify-'));
  try {
    await extractTar({ cwd: extractionParent, file: archive, strict: true, preservePaths: false });
    const names = await readdir(extractionParent);
    if (names.length !== 1 || names[0] !== ROOT_NAME) throw new Error('Archive must have exactly one expected root directory');
    const root = path.join(extractionParent, ROOT_NAME);
    const manifestPath = path.join(root, 'MANIFEST.sha256');
    const manifestBuffer = await readFile(manifestPath);
    if (sha256(manifestBuffer) !== expectedManifestSha) throw new Error('Extracted manifest hash mismatch');
    const rows = manifestBuffer.toString('utf8').trimEnd().split('\n');
    if (rows.length !== expectedManifestCount) throw new Error('Extracted manifest entry count mismatch');
    for (const row of rows) {
      const match = /^([a-f0-9]{64})  ([0-9]+)  (.+)$/u.exec(row);
      if (!match) throw new Error(`Malformed manifest row: ${row}`);
      const filename = path.resolve(root, ...match[3].split('/'));
      if (!filename.startsWith(`${root}${path.sep}`)) throw new Error('Unsafe manifest path');
      const buffer = await readFile(filename);
      if (buffer.byteLength !== Number(match[2]) || sha256(buffer) !== match[1]) {
        throw new Error(`Manifest verification failed: ${match[3]}`);
      }
    }
    await validateTree(root);
  } finally {
    await rm(extractionParent, { recursive: true, force: true });
  }
}

async function main() {
  const sourceReal = await realpath(source);
  const sourceInfo = await stat(sourceReal);
  if (!sourceInfo.isDirectory()) throw new Error('Sample source must be a directory');
  if (outputDirectory === repoRoot || outputDirectory.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('Release output must stay outside the public Git repository');
  }
  await mkdir(outputDirectory, { recursive: true });
  const finalArchive = path.join(outputDirectory, ARCHIVE_NAME);
  const reservation = await open(finalArchive, 'wx');
  await reservation.close();

  const stagingParent = await mkdtemp(path.join(os.tmpdir(), 'rtltasks-package-'));
  const stagingRoot = path.join(stagingParent, ROOT_NAME);
  try {
    await cp(sourceReal, stagingRoot, { recursive: true, errorOnExist: true, force: false });
    await rm(path.join(stagingRoot, 'MANIFEST.sha256'));
    await copyFile(path.join(repoRoot, 'product', 'BUYER_README.md'), path.join(stagingRoot, 'SALE-README.md'));
    await copyFile(path.join(repoRoot, 'product', 'THIRD_PARTY_NOTICES.md'), path.join(stagingRoot, 'THIRD_PARTY_NOTICES.md'));
    await copyFile(path.join(repoRoot, 'product', 'SAMPLE_LICENSE.md'), path.join(stagingRoot, 'SAMPLE_LICENSE.md'));
    await copyFile(path.join(repoRoot, 'product', 'DELIVERY_AND_REFUND.md'), path.join(stagingRoot, 'DELIVERY_AND_REFUND.md'));
    const release = {
      schema_version: 'rtltasks.release.v1',
      product_id: PRODUCT_ID,
      sku: SKU,
      artifact_version: VERSION,
      sample_id: SAMPLE_ID,
      archive_filename: ARCHIVE_NAME,
      root_directory: ROOT_NAME,
      terms_version: VERSION,
      release_epoch: RELEASE_EPOCH,
      released_at: RELEASE_DATE,
      benchmark_claim_allowed: false,
    };
    await writeFile(path.join(stagingRoot, 'RELEASE.json'), `${JSON.stringify(release, null, 2)}\n`, { mode: 0o644, flag: 'wx' });
    await validateTree(stagingRoot);
    await normalizeTree(stagingRoot);
    const manifest = await writeManifest(stagingRoot);
    await normalizeTree(stagingRoot);

    const firstArchive = path.join(stagingParent, 'first.tar.gz');
    const secondArchive = path.join(stagingParent, 'second.tar.gz');
    await createArchive(stagingParent, firstArchive);
    await createArchive(stagingParent, secondArchive);
    const first = await readFile(firstArchive);
    const second = await readFile(secondArchive);
    if (first.byteLength !== second.byteLength || sha256(first) !== sha256(second)) {
      throw new Error('Deterministic double-build check failed');
    }
    await verifyExtractedArchive(firstArchive, manifest.count, manifest.sha256);
    await copyFile(firstArchive, `${finalArchive}.partial`);
    await rename(`${finalArchive}.partial`, finalArchive);

    const archiveInfo = await stat(finalArchive);
    const archiveSha256 = await sha256File(finalArchive);
    const objectKey = `artifacts/${PRODUCT_ID}/v${VERSION}/sha256/${archiveSha256}/${ARCHIVE_NAME}`;
    const metadata = {
      schema_version: 'rtltasks.artifact.v1',
      product_id: PRODUCT_ID,
      sku: SKU,
      artifact_version: VERSION,
      sample_id: SAMPLE_ID,
      archive_filename: ARCHIVE_NAME,
      root_directory: ROOT_NAME,
      object_key: objectKey,
      content_type: 'application/gzip',
      archive_bytes: archiveInfo.size,
      archive_sha256: `sha256:${archiveSha256}`,
      manifest_path: 'MANIFEST.sha256',
      manifest_sha256: `sha256:${manifest.sha256}`,
      manifest_entry_count: manifest.count,
      sale_readme_sha256: `sha256:${await sha256File(path.join(stagingRoot, 'SALE-README.md'))}`,
      third_party_notices_sha256: `sha256:${await sha256File(path.join(stagingRoot, 'THIRD_PARTY_NOTICES.md'))}`,
      terms_version: VERSION,
      terms_sha256: `sha256:${await sha256File(path.join(stagingRoot, 'SAMPLE_LICENSE.md'))}`,
      release_epoch: RELEASE_EPOCH,
      released_at: RELEASE_DATE,
    };
    await writeFile(`${finalArchive}.sha256`, `${archiveSha256}  ${ARCHIVE_NAME}\n`, { encoding: 'utf8', flag: 'wx' });
    await writeFile(`${finalArchive}.metadata.json`, `${JSON.stringify(metadata, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
  } catch (error) {
    await rm(finalArchive, { force: true });
    await rm(`${finalArchive}.partial`, { force: true });
    await rm(`${finalArchive}.sha256`, { force: true });
    await rm(`${finalArchive}.metadata.json`, { force: true });
    throw error;
  } finally {
    await rm(stagingParent, { recursive: true, force: true });
  }
}

await main();
