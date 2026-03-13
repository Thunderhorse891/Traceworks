import { PACKAGES } from './_lib/packages.js';
import { sendJsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonWithRequestId(req, res, 405, { error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `packages:${ip}`, windowMs: 60_000, max: 60 });

  if (limit.limited) {
    return sendJsonWithRequestId(req, res, 429, { error: 'Too many requests.' });
  }

  const packages = Object.values(PACKAGES).filter((pkg) => Number(pkg.amount || 0) > 0);

  return sendJsonWithRequestId(req, res, 200, {
    ok: true,
    packages,
  });
}
