const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const MAX_TRACKED_KEYS = 5000;

// Plain in-process rate limiting — no external service, no account, no
// database. Each bucket is just a request-count-per-window kept in memory,
// keyed by "prefix:key" (e.g. "checkout:203.0.113.4"), matching the same
// 10-requests-per-60-seconds shape Cloudflare's rate-limiting binding used.
// This only limits per-instance: a serverless function can have multiple
// concurrent instances, so a determined abuser spread across instances
// could exceed the nominal limit. That tradeoff is accepted here in favor
// of not depending on a third-party rate-limiting service; Stripe's own
// idempotency keys still prevent duplicate charges regardless.
const buckets = new Map();

function sweepExpired(now) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= WINDOW_MS) buckets.delete(key);
  }
}

export async function checkRateLimit(env, prefix, key) {
  if (typeof env.__rateLimitOverride === 'function') {
    return env.__rateLimitOverride(prefix, key);
  }

  const bucketKey = `${prefix}:${key}`;
  const now = Date.now();
  if (buckets.size > MAX_TRACKED_KEYS) sweepExpired(now);

  const bucket = buckets.get(bucketKey);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(bucketKey, { windowStart: now, count: 1 });
    return { success: true };
  }
  if (bucket.count >= MAX_REQUESTS) {
    return { success: false };
  }
  bucket.count += 1;
  return { success: true };
}
