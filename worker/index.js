import { createCheckout } from './checkout.js';
import { getSiteOrigin } from './config.js';
import { redirect, safeErrorCode } from './http.js';
import {
  apiNotFound,
  checkoutSuccess,
  downloadSample,
  purchaseSuccessPage,
  publicErrorResponse,
  recoverPurchase,
  storeStatus,
  stripeWebhook,
} from './handlers.js';

export default {
  async fetch(request, env, ctx) {
    const requestUrl = new URL(request.url);
    const path = requestUrl.pathname;
    try {
      const siteOrigin = getSiteOrigin(env);
      if (requestUrl.origin !== siteOrigin) {
        const canonicalUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, siteOrigin);
        return redirect(canonicalUrl.toString(), 308);
      }

      switch (path) {
        case '/api/store-status':
          return await storeStatus(request, env);
        case '/api/create-checkout-session':
          return await createCheckout(request, env);
        case '/api/checkout-success':
          return await checkoutSuccess(request, env);
        case '/api/recover-purchase':
          return await recoverPurchase(request, env);
        case '/api/stripe-webhook':
          return await stripeWebhook(request, env);
        case '/api/download-sample':
          return await downloadSample(request, env, ctx);
        case '/purchase-success':
        case '/purchase-success/':
          return await purchaseSuccessPage(request, env);
        default:
          if (path.startsWith('/api/')) return apiNotFound();
          if (path.startsWith('/__private/')) return apiNotFound();
          return env.ASSETS.fetch(request);
      }
    } catch (error) {
      console.error(JSON.stringify({
        route: path,
        error: error?.name || 'Error',
        code: safeErrorCode(error),
      }));
      return publicErrorResponse(request, env, error);
    }
  },
};
