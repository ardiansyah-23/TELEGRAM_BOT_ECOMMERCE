import type { VercelRequest, VercelResponse } from '@vercel/node';

import route_0 from '../api_routes/admin/health';
import route_1 from '../api_routes/admin/inventory/adjust';
import route_2 from '../api_routes/admin/inventory/index';
import route_3 from '../api_routes/admin/logs';
import route_4 from '../api_routes/admin/reviews';
import route_5 from '../api_routes/admin/stats';
import route_6 from '../api_routes/admin/tickets';
import route_7 from '../api_routes/admin/variants';
import route_8 from '../api_routes/cron';
import route_9 from '../api_routes/health';
import route_10 from '../api_routes/payment/webhook';
import route_11 from '../api_routes/twa/cart';
import route_12 from '../api_routes/twa/checkout';
import route_13 from '../api_routes/twa/me';
import route_14 from '../api_routes/twa/orders';
import route_15 from '../api_routes/twa/products';
import route_16 from '../api_routes/twa/reviews';
import route_17 from '../api_routes/twa/settings';
import route_18 from '../api_routes/twa/wishlists';
import route_19 from '../api_routes/web/tickets';
import route_20 from '../api_routes/webhook';


export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Vercel req.url could be /api/twa/cart?foo=bar
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let pathName = url.pathname;
    
    // Normalize path by removing trailing slash if exists (except for root)
    if (pathName.length > 1 && pathName.endsWith('/')) {
      pathName = pathName.slice(0, -1);
    }

    switch (pathName) {
    case '/api/admin/health': return await route_0(req, res);
    case '/api/admin/inventory/adjust': return await route_1(req, res);
    case '/api/admin/inventory': return await route_2(req, res);
    case '/api/admin/logs': return await route_3(req, res);
    case '/api/admin/reviews': return await route_4(req, res);
    case '/api/admin/stats': return await route_5(req, res);
    case '/api/admin/tickets': return await route_6(req, res);
    case '/api/admin/variants': return await route_7(req, res);
    case '/api/cron': return await route_8(req, res);
    case '/api/health': return await route_9(req, res);
    case '/api/payment/webhook': return await route_10(req, res);
    case '/api/twa/cart': return await route_11(req, res);
    case '/api/twa/checkout': return await route_12(req, res);
    case '/api/twa/me': return await route_13(req, res);
    case '/api/twa/orders': return await route_14(req, res);
    case '/api/twa/products': return await route_15(req, res);
    case '/api/twa/reviews': return await route_16(req, res);
    case '/api/twa/settings': return await route_17(req, res);
    case '/api/twa/wishlists': return await route_18(req, res);
    case '/api/web/tickets': return await route_19(req, res);
    case '/api/webhook': return await route_20(req, res);

      default:
        return res.status(404).json({ error: 'API Route Not Found: ' + pathName });
    }
  } catch (error) {
    console.error('Error in API Router:', error);
    return res.status(500).json({ error: 'Internal Server Error in Router' });
  }
}
