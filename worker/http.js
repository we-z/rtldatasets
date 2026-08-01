export class HttpError extends Error {
  constructor(status, publicCode, message = publicCode) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.publicCode = publicCode;
  }
}

export const NO_STORE_HEADERS = Object.freeze({
  'Cache-Control': 'private, no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
});

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...NO_STORE_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

export function redirect(location, status = 303, extraHeaders = {}) {
  const headers = new Headers({ ...NO_STORE_HEADERS, Location: location });
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }
  return new Response(null, { status, headers });
}

export function assertMethod(request, expected) {
  if (request.method !== expected) {
    throw new HttpError(405, 'method_not_allowed');
  }
}

export function assertSameOrigin(request, siteOrigin) {
  const origin = request.headers.get('Origin');
  if (origin !== siteOrigin) {
    throw new HttpError(403, 'invalid_origin');
  }
}

export async function readUrlEncodedForm(request, maxBytes = 4096) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
    throw new HttpError(415, 'unsupported_media_type');
  }
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > maxBytes) {
    throw new HttpError(413, 'request_too_large');
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new HttpError(413, 'request_too_large');
  }
  return new URLSearchParams(text);
}

export function safeErrorCode(error) {
  if (error instanceof HttpError) return error.publicCode;
  if (error?.name === 'ConfigError') return 'store_not_configured';
  return 'temporary_error';
}
