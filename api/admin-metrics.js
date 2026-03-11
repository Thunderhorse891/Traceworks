import { getMetrics } from './_lib/store.js';
import { sendJsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJsonWithRequestId(req, res, 405, { error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || req.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `admin:${ip}`, windowMs: 60_000, max: 30 });
  if (limit.limited) return sendJsonWithRequestId(req, res, 429, { error: 'Too many requests.' });

  const auth = req.headers.authorization || '';
  const key = process.env.ADMIN_API_KEY;
  if (!key) return sendJsonWithRequestId(req, res, 500, { error: 'ADMIN_API_KEY is not configured.' });
  if (auth !== `Bearer ${key}`) return sendJsonWithRequestId(req, res, 401, { error: 'Unauthorized' });

  const metrics = await getMetrics();
  const threshold = Math.max(60_000, Number(process.env.QUEUE_LAG_ALERT_MS || 15 * 60_000));
  const degraded = metrics.queueOldestMs >= threshold || Number(metrics.byStatus?.failed || 0) > 0;

  return sendJsonWithRequestId(req, res, 200, {
    ok: true,
    degraded,
    metrics,
    queueLagAlertMs: threshold
  });
}
