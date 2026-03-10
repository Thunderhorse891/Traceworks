import { recordAnalytics } from './_lib/store.js';
import { sendJsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';

function safe(v, max = 200) {
  return String(v || '').trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJsonWithRequestId(req, res, 405, { error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || req.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `track:${ip}`, windowMs: 60_000, max: 120 });
  if (limit.limited) return sendJsonWithRequestId(req, res, 429, { error: 'Too many requests.' });

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return sendJsonWithRequestId(req, res, 400, { error: 'Invalid JSON payload.' });
  }

  await recordAnalytics({
    type: safe(body.type, 80) || 'unknown',
    packageId: safe(body.packageId, 40),
    caseRef: safe(body.caseRef, 80),
    page: safe(body.page, 80),
    detail: safe(body.detail, 400)
  });

  return sendJsonWithRequestId(req, res, 200, { ok: true });
}
