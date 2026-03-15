import { auditLaunchReadiness } from './_lib/launch-audit.js';
import { requireAdmin } from './_lib/admin-auth.js';
import { jsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';

export default async (event) => {
  if (event.httpMethod !== 'GET') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `launch-audit:${ip}`, windowMs: 60_000, max: 20 });
  if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests.' });

  const auth = requireAdmin(event);
  if (!auth.ok) return auth.response;

  return jsonWithRequestId(event, 200, auditLaunchReadiness(process.env));
};
