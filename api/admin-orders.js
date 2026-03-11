/**
 * GET /api/admin-orders
 * Returns paginated list of all orders.
 * Protected by ADMIN_API_KEY Bearer token.
 *
 * Query params:
 *   ?limit=50       — max orders to return (default 50, max 200)
 *   ?status=failed  — filter by order status
 *   ?since=ISO8601  — filter by createdAt >= since
 */

import { getAllOrders } from './_lib/store.js';
import { sendJsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonWithRequestId(req, res, 405, { error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `admin-orders:${ip}`, windowMs: 60_000, max: 30 });
  if (limit.limited) {
    return sendJsonWithRequestId(req, res, 429, { error: 'Too many requests.' });
  }

  const auth = req.headers.authorization || '';
  const key = process.env.ADMIN_API_KEY;
  if (!key) {
    return sendJsonWithRequestId(req, res, 500, { error: 'ADMIN_API_KEY is not configured.' });
  }
  if (auth !== `Bearer ${key}`) {
    return sendJsonWithRequestId(req, res, 401, { error: 'Unauthorized' });
  }

  const { limit: limitParam = '50', status: statusFilter = '', since: sinceParam = '' } = req.query || {};
  const pageLimit = Math.min(200, Math.max(1, parseInt(limitParam, 10) || 50));

  let orders = await getAllOrders();

  // Apply filters
  if (statusFilter) {
    orders = orders.filter((o) => o.status === statusFilter);
  }
  if (sinceParam) {
    const sinceMs = new Date(sinceParam).getTime();
    if (!isNaN(sinceMs)) {
      orders = orders.filter((o) => new Date(o.createdAt || 0).getTime() >= sinceMs);
    }
  }

  const total = orders.length;
  const page = orders.slice(0, pageLimit);

  // Compute quick aggregate stats
  const byStatus = {};
  for (const o of orders) {
    byStatus[o.status || 'unknown'] = (byStatus[o.status || 'unknown'] || 0) + 1;
  }

  const revenueTotal = orders.reduce((sum, o) => sum + (Number(o.amountTotal || 0)), 0);

  return sendJsonWithRequestId(req, res, 200, {
    ok: true,
    total,
    returned: page.length,
    limit: pageLimit,
    filters: { status: statusFilter || null, since: sinceParam || null },
    aggregate: {
      byStatus,
      revenueTotal,
      revenueTotalFormatted: `$${(revenueTotal / 100).toFixed(2)}`,
    },
    orders: page,
  });
}
