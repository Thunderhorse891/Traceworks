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

  const orders = await listOrders(300);
  return jsonWithRequestId(event, 200, { ok: true, orders });
};
