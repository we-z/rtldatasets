import { PRODUCT } from './product.js';
import { artifactExists } from './artifact.js';

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

function requiredString(env, key) {
  const value = env[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ConfigError(`Missing ${key}`);
  }
  return value.trim();
}

export function getSiteOrigin(env) {
  const raw = typeof env.SITE_URL === 'string' && env.SITE_URL.trim()
    ? env.SITE_URL.trim()
    : 'https://www.rtltasks.com';
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError('SITE_URL must be an absolute URL');
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new ConfigError('SITE_URL must use HTTPS outside local development');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new ConfigError('SITE_URL cannot contain credentials, a query, or a fragment');
  }
  return url.origin;
}

export function stripeKeyIsLive(secretKey) {
  if (/^(sk|rk)_live_/.test(secretKey)) return true;
  if (/^(sk|rk)_test_/.test(secretKey)) return false;
  throw new ConfigError('Stripe key must be a test or live secret/restricted key');
}

export function getStoreConfig(env) {
  const siteOrigin = getSiteOrigin(env);
  const stripeSecretKey = requiredString(env, 'STRIPE_SECRET_KEY');
  const stripeMode = requiredString(env, 'STRIPE_MODE');
  if (stripeMode !== 'live' && stripeMode !== 'test') {
    throw new ConfigError('STRIPE_MODE must be live or test');
  }
  const stripeLivemode = stripeKeyIsLive(stripeSecretKey);
  if (stripeLivemode !== (stripeMode === 'live')) {
    throw new ConfigError('Stripe key does not match STRIPE_MODE');
  }
  const signingSecret = requiredString(env, 'ENTITLEMENT_SIGNING_SECRET');
  if (new TextEncoder().encode(signingSecret).byteLength < 32) {
    throw new ConfigError('ENTITLEMENT_SIGNING_SECRET must be at least 32 bytes');
  }

  const artifactSha256 = requiredString(env, 'SAMPLE_ARCHIVE_SHA256').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(artifactSha256)) {
    throw new ConfigError('SAMPLE_ARCHIVE_SHA256 must be 64 lowercase hex characters');
  }
  if (artifactSha256 !== PRODUCT.archiveSha256) {
    throw new ConfigError('SAMPLE_ARCHIVE_SHA256 does not match the released artifact');
  }
  const artifactAssetPath = requiredString(env, 'SAMPLE_ASSET_PATH');
  if (
    !artifactAssetPath.startsWith('/__private/') ||
    artifactAssetPath.includes('..') ||
    artifactAssetPath.includes('//') ||
    artifactAssetPath.includes('?') ||
    artifactAssetPath.includes('#')
  ) {
    throw new ConfigError('SAMPLE_ASSET_PATH must be a protected absolute asset path');
  }
  if (!artifactAssetPath.includes(`/sha256/${artifactSha256}/`)) {
    throw new ConfigError('SAMPLE_ASSET_PATH must contain its immutable SHA-256 path');
  }
  if (!artifactAssetPath.includes(`/v${PRODUCT.artifactVersion}/`)) {
    throw new ConfigError('SAMPLE_ASSET_PATH must contain the released artifact version');
  }
  if (!artifactAssetPath.endsWith(`/${PRODUCT.archiveFilename}`)) {
    throw new ConfigError('SAMPLE_ASSET_PATH must end with the fixed archive filename');
  }
  if (artifactAssetPath !== PRODUCT.artifactAssetPath) {
    throw new ConfigError('SAMPLE_ASSET_PATH does not match the released artifact');
  }
  const archiveBytes = Number(requiredString(env, 'SAMPLE_ARCHIVE_BYTES'));
  if (!Number.isSafeInteger(archiveBytes) || archiveBytes <= 0) {
    throw new ConfigError('SAMPLE_ARCHIVE_BYTES must be a positive integer');
  }
  if (archiveBytes !== PRODUCT.archiveBytes) {
    throw new ConfigError('SAMPLE_ARCHIVE_BYTES does not match the released artifact');
  }

  requiredString(env, 'DATABASE_URL');
  requiredString(env, 'UPSTASH_REDIS_REST_URL');
  requiredString(env, 'UPSTASH_REDIS_REST_TOKEN');
  if (!artifactExists(env)) {
    throw new ConfigError('Protected artifact is not staged for this deployment');
  }

  return Object.freeze({
    siteOrigin,
    stripeSecretKey,
    stripeWebhookSecret: requiredString(env, 'STRIPE_WEBHOOK_SECRET'),
    stripePriceId: requiredString(env, 'STRIPE_SAMPLE_PRICE_ID'),
    stripeLivemode,
    automaticTax: env.STRIPE_AUTOMATIC_TAX === 'true',
    signingSecret,
    artifactSha256,
    artifactAssetPath,
    archiveBytes,
  });
}

export function getStoreAvailability(env) {
  if (env.STORE_LIVE !== 'true') {
    return { available: false };
  }
  try {
    getStoreConfig(env);
    return { available: true };
  } catch {
    return { available: false };
  }
}
