import { getSiteOrigin } from './config.js';
import { redirect } from './http.js';

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    const siteOrigin = getSiteOrigin(env);
    if (requestUrl.origin !== siteOrigin) {
      const canonicalUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, siteOrigin);
      return redirect(canonicalUrl.toString(), 308);
    }
    return env.ASSETS.fetch(request);
  },
};
