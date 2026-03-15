import { requireAdmin } from './_lib/admin-auth.js';
import { jsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { listLaunchProofs, recordLaunchProof } from './_lib/store.js';
import { runSourceProof } from './_lib/source-proof.js';

function clean(value) {
  return String(value || '').trim();
}

function proofSnapshot(result) {
  return {
    ok: Boolean(result.ok),
    launchBlocked: Boolean(result.launchBlocked),
    packageId: result.packageId || '',
    packageName: result.packageName || '',
    subjectName: result.input?.subjectName || '',
    subjectType: result.input?.subjectType || '',
    county: result.input?.county || '',
    state: result.input?.state || '',
    query: result.query || '',
    summary: result.summary || null,
    providerHealth: result.providerHealth || [],
    providerNote: result.providerNote || '',
    topSources: Array.isArray(result.topSources) ? result.topSources.slice(0, 5) : [],
    publicRecordGaps: result.summary?.publicRecordGaps || [],
    orderCoverage: result.orderCoverage || null,
    errors: result.errors || [],
    blockingAreas: result.blockingAreas || [],
    blockingDetails: result.blockingDetails || []
  };
}

export default async (event) => {
  return handleSourceProof(event);
};

export async function handleSourceProof(event, deps = {}) {
  const auth = requireAdmin(event);
  if (!auth.ok) return auth.response;

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `source-proof:${ip}`, windowMs: 60_000, max: 20 });
  if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests.' });

  if (event.httpMethod === 'GET') {
    const limitParam = clean(event.queryStringParameters?.limit || '6');
    const listProofs = deps.listLaunchProofsImpl || listLaunchProofs;
    const proofs = await listProofs(limitParam);
    return jsonWithRequestId(event, 200, { ok: true, proofs });
  }

  if (event.httpMethod !== 'POST') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonWithRequestId(event, 400, { error: 'Invalid JSON payload.' });
  }

  const runProof = deps.runSourceProofImpl || runSourceProof;
  const result = await runProof(body);
  const saveProof = deps.recordLaunchProofImpl || recordLaunchProof;
  await saveProof(proofSnapshot(result));

  if (!result.ok && !result.launchBlocked) {
    return jsonWithRequestId(event, 400, result);
  }

  if (!result.ok && result.launchBlocked) {
    return jsonWithRequestId(event, 409, result);
  }

  return jsonWithRequestId(event, 200, result);
}
