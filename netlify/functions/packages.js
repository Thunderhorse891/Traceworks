import { jsonWithRequestId } from './_lib/http.js';
import { createModernHandler } from './_lib/netlify-modern.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { PACKAGE_LIST } from './_lib/packages.js';
import { listPackageLaunchStatus } from './_lib/launch-audit.js';

export async function handler(event) {
  if (event.httpMethod !== 'GET') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `packages:${ip}`, windowMs: 60_000, max: 120 });
  if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests.' });

  const readinessById = new Map(listPackageLaunchStatus(process.env).map((item) => [item.id, item]));
  const packages = PACKAGE_LIST.map((pkg) => ({
    ...pkg,
    ...(readinessById.get(pkg.id) || {})
  }));

  return jsonWithRequestId(event, 200, { ok: true, packages });
}

export default createModernHandler(handler);
