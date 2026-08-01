import Stripe from 'stripe';

export const STRIPE_API_VERSION = '2026-07-29.dahlia';
export const stripeCryptoProvider = Stripe.createSubtleCryptoProvider();

export function createStripe(config) {
  return new Stripe(config.stripeSecretKey, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    telemetry: false,
    appInfo: {
      name: 'rtldatasets.com',
      version: '1.0.0',
      url: 'https://www.rtldatasets.com',
    },
  });
}
