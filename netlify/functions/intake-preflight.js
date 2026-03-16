import { buildInputCriteria, normalizeCheckoutPayload, validateCheckoutPayload } from './_lib/validation.js';
import { assessOrderLaunchGate } from './_lib/launch-audit.js';
import { jsonWithRequestId } from './_lib/http.js';
import { createModernHandler } from './_lib/netlify-modern.js';
import { hitRateLimit } from './_lib/rate-limit.js';

function normalizePreflightPayload(raw = {}) {
  return normalizeCheckoutPayload({
    packageId: raw.packageId,
    customerName: 'TraceWorks Preflight',
    customerEmail: 'preflight@traceworks.local',
    subjectName: raw.subjectName || raw.companyName || 'Preflight Subject',
    companyName: raw.companyName || raw.subjectName || 'Preflight Subject',
    subjectType: raw.subjectType || 'person',
    county: raw.county || '',
    state: raw.state || 'TX',
    lastKnownAddress: raw.lastKnownAddress || raw.address || '',
    websiteProfile: raw.websiteProfile || raw.website || '',
    parcelId: raw.parcelId || '',
    alternateNames: raw.alternateNames || [],
    dateOfBirth: raw.dateOfBirth || '',
    deathYear: raw.deathYear || '',
    subjectPhone: raw.subjectPhone || '',
    subjectEmail: raw.subjectEmail || '',
    requestedFindings: raw.requestedFindings || '',
    goals: raw.goals || '',
    legalConsent: true,
    tosConsent: true
  });
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `intake-preflight:${ip}`, windowMs: 60_000, max: 60 });
  if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests. Try again shortly.' });

  let rawPayload = {};
  try {
    rawPayload = JSON.parse(event.body || '{}');
  } catch {
    return jsonWithRequestId(event, 400, { error: 'Invalid JSON payload.' });
  }

  const payload = normalizePreflightPayload(rawPayload);
  const errors = validateCheckoutPayload(payload)
    .filter((error) => !error.includes('Legal use acknowledgement'))
    .filter((error) => !error.includes('Terms consent'));

  if (errors.length) {
    return jsonWithRequestId(event, 400, {
      error: errors[0],
      errors
    });
  }

  const inputCriteria = buildInputCriteria(payload);
  const launchGate = assessOrderLaunchGate(payload.packageId, inputCriteria, process.env);

  return jsonWithRequestId(event, 200, {
    ok: launchGate.launchReady,
    packageId: payload.packageId,
    location: launchGate.orderCoverage?.locationLabel || '',
    launchReady: launchGate.launchReady,
    launchMessage: launchGate.launchMessage,
    readinessSummary: launchGate.readinessSummary,
    blockingAreas: launchGate.launchBlockingAreas,
    blockingDetails: launchGate.launchBlockingDetails,
    manualReviewLikely: Boolean(launchGate.manualReviewLikely),
    manualReviewDetails: launchGate.manualReviewDetails || [],
    coverage: launchGate.orderCoverage || null
  });
}

export default createModernHandler(handler);
