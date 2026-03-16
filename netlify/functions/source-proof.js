import { requireAdmin } from './_lib/admin-auth.js';
import { jsonWithRequestId } from './_lib/http.js';
import { createModernHandler } from './_lib/netlify-modern.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { listLaunchProofs, recordLaunchProof } from './_lib/store.js';
import { runSourceProof } from './_lib/source-proof.js';

function clean(value) {
  return String(value || '').trim();
}

function errorDetail(error) {
  return clean(error?.message || error);
}

function sanitizeInput(input = {}) {
  return {
    subjectName: input.subjectName || '',
    subjectType: input.subjectType || '',
    county: input.county || '',
    state: input.state || '',
    lastKnownAddress: input.lastKnownAddress || '',
    parcelId: input.parcelId || '',
    websiteProfile: input.websiteProfile || ''
  };
}

function sanitizeProviderHealth(providerHealth = []) {
  return Array.isArray(providerHealth)
    ? providerHealth.slice(0, 12).map((item) => ({
        provider: item?.provider || '',
        ok: Boolean(item?.ok),
        hitCount: Number(item?.hitCount || 0),
        attempts: Number(item?.attempts || 0),
        error: item?.error ? String(item.error) : null
      }))
    : [];
}

function sanitizeTopSources(topSources = []) {
  return Array.isArray(topSources)
    ? topSources.slice(0, 5).map((source) => ({
        title: source?.title || '',
        url: source?.url || '',
        sourceType: source?.sourceType || '',
        confidence: source?.confidence || '',
        provider: source?.provider || '',
        domain: source?.domain || ''
      }))
    : [];
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
    providerHealth: sanitizeProviderHealth(result.providerHealth),
    providerNote: result.providerNote || '',
    topSources: sanitizeTopSources(result.topSources),
    publicRecordGaps: result.summary?.publicRecordGaps || [],
    orderCoverage: result.orderCoverage || null,
    errors: result.errors || [],
    blockingAreas: result.blockingAreas || [],
    blockingDetails: result.blockingDetails || []
  };
}

function proofResponse(result) {
  return {
    ...proofSnapshot(result),
    startedAt: result.startedAt || null,
    completedAt: result.completedAt || null,
    launchMessage: result.launchMessage || '',
    input: sanitizeInput(result.input),
    orderCoverage: result.orderCoverage || null
  };
}

export async function handler(event) {
  return handleSourceProof(event);
}

export default createModernHandler(handler);

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
  let result;
  try {
    result = await runProof(body);
  } catch (error) {
    return jsonWithRequestId(event, 500, {
      error: 'Source proof execution failed.',
      detail: errorDetail(error)
    });
  }

  const saveProof = deps.recordLaunchProofImpl || recordLaunchProof;
  try {
    await saveProof(proofSnapshot(result));
  } catch (error) {
    return jsonWithRequestId(event, 500, {
      error: 'Source proof persistence failed.',
      detail: errorDetail(error)
    });
  }

  if (!result.ok && !result.launchBlocked) {
    return jsonWithRequestId(event, 400, proofResponse(result));
  }

  if (!result.ok && result.launchBlocked) {
    return jsonWithRequestId(event, 409, proofResponse(result));
  }

  return jsonWithRequestId(event, 200, proofResponse(result));
}
