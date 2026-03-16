import { recordAnalytics } from './_lib/store.js';
import { jsonWithRequestId } from './_lib/http.js';
import { createModernHandler } from './_lib/netlify-modern.js';
import { hitRateLimit } from './_lib/rate-limit.js';

function safe(v, max = 200) {
  return String(v || '').trim().slice(0, max);
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `track:${ip}`, windowMs: 60_000, max: 120 });
  if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests.' });

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonWithRequestId(event, 400, { error: 'Invalid JSON payload.' });
  }

  await recordAnalytics({
    type: safe(body.type, 80) || 'unknown',
    packageId: safe(body.packageId, 40),
    caseRef: safe(body.caseRef, 80),
    page: safe(body.page, 80),
    detail: safe(body.detail, 400)
  });

  return jsonWithRequestId(event, 200, { ok: true });
}

export default createModernHandler(handler);
