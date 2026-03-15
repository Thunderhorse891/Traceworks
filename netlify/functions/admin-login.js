import { buildAdminSessionCookie, createAdminSessionToken } from './_lib/admin-session.js';
import { jsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';

function clean(value) {
  return String(value || '').trim();
}

export default async (event) => {
  if (event.httpMethod !== 'POST') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `admin-login:${ip}`, windowMs: 60_000, max: 20 });
  if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests.' });

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonWithRequestId(event, 400, { error: 'Invalid JSON payload.' });
  }

  const suppliedKey = clean(body.apiKey || body.key);
  const configuredKey = clean(process.env.ADMIN_API_KEY);
  if (!configuredKey) return jsonWithRequestId(event, 500, { error: 'ADMIN_API_KEY is not configured.' });
  if (!suppliedKey || suppliedKey !== configuredKey) return jsonWithRequestId(event, 401, { error: 'Invalid API key.' });

  const token = createAdminSessionToken();
  if (!token) return jsonWithRequestId(event, 500, { error: 'Admin session signing is not configured.' });

  return jsonWithRequestId(event, 200, { ok: true }, {
    'set-cookie': buildAdminSessionCookie(token, event)
  });
};
