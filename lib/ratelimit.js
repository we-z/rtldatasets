import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redisClients = new Map();
const limiters = new Map();

function getRedis(env) {
  const url = env.UPSTASH_REDIS_REST_URL;
  let client = redisClients.get(url);
  if (!client) {
    client = new Redis({ url, token: env.UPSTASH_REDIS_REST_TOKEN });
    redisClients.set(url, client);
  }
  return client;
}

// Same shape as the three keyed buckets the Cloudflare Workers "simple rate
// limiting" binding enforced: 10 requests per 60 seconds, budgeted
// separately per route prefix (checkout/complete/recover) and per client.
function getLimiter(env, prefix) {
  const cacheKey = `${env.UPSTASH_REDIS_REST_URL}:${prefix}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(env),
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      prefix: `rtl_ratelimit:${prefix}`,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

export async function checkRateLimit(env, prefix, key) {
  // Test-only seam: production never sets this, so it always exercises the
  // real Upstash-backed limiter above.
  if (typeof env.__rateLimitOverride === 'function') {
    return env.__rateLimitOverride(prefix, key);
  }
  const { success } = await getLimiter(env, prefix).limit(key);
  return { success };
}
