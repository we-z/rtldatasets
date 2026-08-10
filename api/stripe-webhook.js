import { stripeWebhook } from '../lib/handlers.js';
import { createRouteHandler } from '../lib/route.js';

export default createRouteHandler(stripeWebhook);
