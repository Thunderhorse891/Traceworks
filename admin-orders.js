import { getMetrics } from './_lib/store.js';
import { jsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';

export default async (event) => {
  if (event.httpMethod !== 'GET') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `admin:${ip}`, windowMs: 60_000, max: 30 });
  if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests.' });

  const auth = event.headers.authorization || '';
  const key = process.env.ADMIN_API_KEY;
  if (!key) return jsonWithRequestId(event, 500, { error: 'ADMIN_API_KEY is not configured.' });
  if (auth !== `Bearer ${key}`) return jsonWithRequestId(event, 401, { error: 'Unauthorized' });

  const metrics = await getMetrics();
  const threshold = Math.max(60_000, Number(process.env.QUEUE_LAG_ALERT_MS || 15 * 60_000));
  const degraded = metrics.queueOldestMs >= threshold || Number(metrics.jobsByStatus?.failed || 0) > 0;
  return jsonWithRequestId(event, 200, { ok: true, degraded, metrics, queueLagAlertMs: threshold });
};
