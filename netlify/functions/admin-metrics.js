import { requireAdmin } from './_lib/admin-auth.js';
import { getMetrics, getOperationsSnapshot } from './_lib/store.js';
import { jsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { createModernHandler } from './_lib/netlify-modern.js';

export async function handler(event) {
  if (event.httpMethod !== 'GET') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `admin:${ip}`, windowMs: 60_000, max: 30 });
  if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests.' });

  const auth = requireAdmin(event);
  if (!auth.ok) return auth.response;

  const metrics = await getMetrics();
  const operations = await getOperationsSnapshot(10);
  const threshold = Math.max(60_000, Number(process.env.QUEUE_LAG_ALERT_MS || 15 * 60_000));
  const degraded =
    metrics.queueOldestMs >= threshold ||
    Number(metrics.jobsByStatus?.failed || 0) > 0 ||
    operations.recentDeadLetters.length > 0;

  return jsonWithRequestId(event, 200, {
    ok: true,
    degraded,
    metrics,
    operations,
    queueLagAlertMs: threshold
  });
}

export default createModernHandler(handler);
