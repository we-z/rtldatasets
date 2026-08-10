import { storeStatus } from '../lib/handlers.js';
import { createRouteHandler } from '../lib/route.js';
import { toNodeHandler } from '../lib/node-handler.js';

export default toNodeHandler(createRouteHandler(storeStatus));
