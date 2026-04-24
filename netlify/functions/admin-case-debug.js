import { requireAdmin } from './_lib/admin-auth.js';
import { jsonWithRequestId } from './_lib/http.js';
import { createModernHandler } from './_lib/netlify-modern.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { getOrder } from './_lib/store.js';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function buildOsintDebug(order) {
  const workflow = order?.workflow_results || {};
  const osint = workflow?.osint || {};
  return {
    caseRef: order?.caseRef || order?.order_id || '',
    packageId: order?.packageId || order?.purchased_tier || workflow?.tier || '',
    status: order?.status || '',
    subjectName: order?.subjectName || workflow?.inputs?.subjectName || '',
    county: order?.county || workflow?.inputs?.county || '',
    state: order?.state || workflow?.inputs?.state || '',
    osint: {
      packageId: osint.packageId || '',
      osintCategories: safeArray(osint.osintCategories),
      preferredProviders: safeArray(osint.preferredProviders),
      queryPlan: safeArray(osint.queryPlan),
      providerHealth: safeArray(osint.providerHealth),
      coverage: osint.coverage || null,
      providerNote: osint.providerNote || '',
      repoReferences: safeArray(osint.repoReferences),
      repoCategoryResults: safeArray(osint.repoCategoryResults).map((category) => ({
        categoryId: category.categoryId || '',
        label: category.label || category.categoryId || '',
        preferredProviders: safeArray(category.preferredProviders),
        queryPlan: safeArray(category.queryPlan),
        repoReferences: safeArray(category.repoReferences),
        providerHealth: safeArray(category.providerHealth),
        sourceCount: safeArray(category.sources).length,
        topSources: safeArray(category.sources).slice(0, 5)
      })),
      topSources: safeArray(osint.sources).slice(0, 12)
    }
  };
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `admin-case-debug:${ip}`, windowMs: 60_000, max: 60 });
  if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests.' });

  const auth = requireAdmin(event);
  if (!auth.ok) return auth.response;

  const caseRef = String(event.queryStringParameters?.caseRef || '').trim();
  if (!caseRef) return jsonWithRequestId(event, 400, { error: 'caseRef is required.' });

  const order = await getOrder(caseRef);
  if (!order) return jsonWithRequestId(event, 404, { error: 'Case not found.' });

  return jsonWithRequestId(event, 200, {
    ok: true,
    debug: buildOsintDebug(order)
  });
}

export default createModernHandler(handler);
