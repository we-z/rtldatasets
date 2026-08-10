import { getSiteOrigin } from './config.js';
import { redirect, requestUrl, safeErrorCode } from './http.js';
import { publicErrorResponse } from './handlers.js';

// Vercel routes each api/*.js file directly to its matching path, unlike the
// single Cloudflare Worker `fetch` router this replaces, so the shared
// canonical-origin redirect + error handling that used to live once in
// worker/index.js is wrapped here and reused by every route file instead.
export function createRouteHandler(handlerFn) {
  return async function handler(request) {
    const url = requestUrl(request);
    try {
      const siteOrigin = getSiteOrigin(process.env);
      if (url.origin !== siteOrigin) {
        const canonicalUrl = new URL(`${url.pathname}${url.search}`, siteOrigin);
        return redirect(canonicalUrl.toString(), 308);
      }
      return await handlerFn(request, process.env);
    } catch (error) {
      console.error(JSON.stringify({
        route: url.pathname,
        error: error?.name || 'Error',
        code: safeErrorCode(error),
      }));
      return publicErrorResponse(request, process.env, error);
    }
  };
}
