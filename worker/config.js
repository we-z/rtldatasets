export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
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
