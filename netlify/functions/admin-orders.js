import { jsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { listOrders } from './_lib/store.js';

export default async (event) => {
  if (event.httpMethod !== 'GET') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `admin-orders:${ip}`, windowMs: 60_000, max: 30 });
  if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests.' });

  const auth = event.headers.authorization || '';
  const key = process.env.ADMIN_API_KEY;
  if (!key) return jsonWithRequestId(event, 500, { error: 'ADMIN_API_KEY is not configured.' });
  if (auth !== `Bearer ${key}`) return jsonWithRequestId(event, 401, { error: 'Unauthorized' });

  const limitParam = event.queryStringParameters?.limit || '50';
  const statusFilter = event.queryStringParameters?.status || '';
  const sinceParam = event.queryStringParameters?.since || '';
  const pageLimit = Math.min(200, Math.max(1, parseInt(limitParam, 10) || 50));

  let orders = await listOrders(1000);
  if (statusFilter) orders = orders.filter((order) => order.status === statusFilter);
  if (sinceParam) {
    const sinceMs = Date.parse(sinceParam);
    if (!Number.isNaN(sinceMs)) {
      orders = orders.filter((order) => Date.parse(order.createdAt || 0) >= sinceMs);
    }
  }

  const total = orders.length;
  const page = orders.slice(0, pageLimit);
  const byStatus = {};
  let revenueTotal = 0;

  for (const order of orders) {
    byStatus[order.status || 'unknown'] = (byStatus[order.status || 'unknown'] || 0) + 1;
    revenueTotal += Number(order.amountTotal || 0);
  }

  return jsonWithRequestId(event, 200, {
    ok: true,
    total,
    returned: page.length,
    limit: pageLimit,
    filters: { status: statusFilter || null, since: sinceParam || null },
    aggregate: {
      byStatus,
      revenueTotal,
      revenueTotalFormatted: `$${(revenueTotal / 100).toFixed(2)}`
    },
    orders: page
  });
};
