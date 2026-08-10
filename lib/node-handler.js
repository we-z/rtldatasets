// Vercel's Node.js Serverless Functions (in this framework-less "Other"
// project, without Next.js) invoke the default export as a classic
// `(req, res)` pair — plain Node `IncomingMessage`/`ServerResponse`, not the
// Web-standard `Request`/`Response` every handler in lib/ is written
// against. This adapter is the only place that bridges the two, so
// lib/route.js and everything it wraps stays platform-agnostic and directly
// unit-testable with plain `Request`/`Response` objects.
function readNodeBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function nodeRequestToWebRequest(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const url = new URL(req.url, `${protocol}://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  // Buffer the body fully rather than passing a converted stream
  // (`Readable.toWeb(req)`) straight through as the Request body: that
  // conversion hangs indefinitely when consumed via `.text()` in Vercel's
  // Node runtime (confirmed by testing the live deployment directly).
  // Every body this app reads is small (form fields, or the Stripe webhook
  // payload, capped at 1MB by lib/handlers.js), so buffering costs nothing.
  const body = hasBody ? await readNodeBody(req) : undefined;
  return new Request(url, {
    method: req.method,
    headers,
    body,
  });
}

async function sendWebResponse(response, res) {
  res.statusCode = response.status;
  for (const [key, value] of response.headers) {
    if (key.toLowerCase() === 'set-cookie') continue;
    res.setHeader(key, value);
  }
  const setCookies = response.headers.getSetCookie?.() || [];
  if (setCookies.length > 0) res.setHeader('Set-Cookie', setCookies);
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function toNodeHandler(webHandler) {
  return async function handler(req, res) {
    const request = await nodeRequestToWebRequest(req);
    const response = await webHandler(request);
    await sendWebResponse(response, res);
  };
}
