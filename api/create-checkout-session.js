import { createCheckout } from '../lib/checkout.js';
import { createRouteHandler } from '../lib/route.js';

export default createRouteHandler(createCheckout);
