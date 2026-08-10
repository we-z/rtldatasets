import Stripe from 'stripe';

export const STRIPE_API_VERSION = '2026-07-29.dahlia';

export function createStripe(config) {
  return new Stripe(config.stripeSecretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    telemetry: false,
    appInfo: {
      name: 'rtltasks.com',
      version: '2.0.0',
      url: 'https://www.rtltasks.com',
    },
  });
}
