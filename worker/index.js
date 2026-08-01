import { createCheckout } from './checkout.js';
import { safeErrorCode } from './http.js';
import {
  apiNotFound,
  checkoutSuccess,
  downloadSample,
  purchaseAccessPage,
  purchaseSuccessPage,
  publicErrorResponse,
  redeemPurchase,
  storeStatus,
  stripeWebhook,
} from './handlers.js';

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    try {
      switch (path) {
        case '/api/store-status':
          return await storeStatus(request, env);
        case '/api/create-checkout-session':
          return await createCheckout(request, env);
        case '/api/checkout-success':
          return await checkoutSuccess(request, env, ctx);
        case '/api/stripe-webhook':
          return await stripeWebhook(request, env);
        case '/api/redeem':
          return await redeemPurchase(request, env);
        case '/api/download-sample':
          return await downloadSample(request, env, ctx);
        case '/purchase-access':
        case '/purchase-access/':
          return await purchaseAccessPage(request, env);
        case '/purchase-success':
        case '/purchase-success/':
          return await purchaseSuccessPage(request, env);
        default:
          if (path.startsWith('/api/')) return apiNotFound();
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
