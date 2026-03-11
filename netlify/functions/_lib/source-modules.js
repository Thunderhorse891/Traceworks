import { CONFIDENCE, makeSourceResult, SOURCE_STATUS } from './workflow-results.js';

async function fetchSourceJson(url, params = {}, fetchImpl = fetch) {
  const full = new URL(url);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') full.searchParams.set(k, String(v));
  }

  const queriedAt = new Date().toISOString();
  try {
    const res = await fetchImpl(full.toString(), { headers: { accept: 'application/json' } });
    if ([401, 403].includes(res.status)) {
      return { status: SOURCE_STATUS.BLOCKED, queriedAt, errorDetail: `Authentication/login required (HTTP ${res.status})`, data: null };
    }
    if (!res.ok) {
      return { status: SOURCE_STATUS.ERROR, queriedAt, errorDetail: `HTTP ${res.status}`, data: null };
    }
    const data = await res.json();
    const empty = data == null || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0);
    if (empty) return { status: SOURCE_STATUS.NOT_FOUND, queriedAt, errorDetail: null, data: null };
    return { status: SOURCE_STATUS.FOUND, queriedAt, errorDetail: null, data };
  } catch (err) {
    return { status: SOURCE_STATUS.ERROR, queriedAt, errorDetail: String(err?.message || err), data: null };
  }
}

function unavailable(sourceId, sourceLabel, reason, queryUsed) {
  return makeSourceResult({
    sourceId,
    sourceLabel,
    sourceUrl: 'n/a',
    queryUsed,
    status: SOURCE_STATUS.UNAVAILABLE,
    confidence: CONFIDENCE.NOT_VERIFIED,
    errorDetail: reason,
    data: null
  });
}

export async function appraisalDistrictScraper({ county, state, query, fetchImpl = fetch, env = process.env }) {
  const sourceUrl = env.APPRAISAL_API_URL;
  const sourceId = 'appraisal_district';
  const sourceLabel = 'County Appraisal District';
  const queryUsed = JSON.stringify({ county, state, query });
  if (!sourceUrl) return unavailable(sourceId, sourceLabel, 'SOURCE_REQUIRES_MANUAL_REVIEW: APPRAISAL_API_URL missing', queryUsed);

  const r = await fetchSourceJson(sourceUrl, { county, state, q: query }, fetchImpl);
  return makeSourceResult({ sourceId, sourceLabel, sourceUrl, queryUsed, status: r.status, errorDetail: r.errorDetail, data: r.data, confidence: r.status === SOURCE_STATUS.FOUND ? CONFIDENCE.LIKELY : CONFIDENCE.NOT_VERIFIED });
}

export async function taxCollectorScraper({ county, state, parcelId, fetchImpl = fetch, env = process.env }) {
  const sourceUrl = env.TAX_COLLECTOR_API_URL;
  const sourceId = 'tax_collector';
  const sourceLabel = 'County Tax Collector';
  const queryUsed = JSON.stringify({ county, state, parcelId });
  if (!sourceUrl) return unavailable(sourceId, sourceLabel, 'SOURCE_REQUIRES_MANUAL_REVIEW: TAX_COLLECTOR_API_URL missing', queryUsed);

  const r = await fetchSourceJson(sourceUrl, { county, state, parcelId }, fetchImpl);
  return makeSourceResult({ sourceId, sourceLabel, sourceUrl, queryUsed, status: r.status, errorDetail: r.errorDetail, data: r.data, confidence: r.status === SOURCE_STATUS.FOUND ? CONFIDENCE.LIKELY : CONFIDENCE.NOT_VERIFIED });
}

export async function parcelGisLookup({ county, state, query, fetchImpl = fetch, env = process.env }) {
  const sourceUrl = env.PARCEL_GIS_API_URL;
  const sourceId = 'parcel_gis';
  const sourceLabel = 'County Parcel GIS';
  const queryUsed = JSON.stringify({ county, state, query });
  if (!sourceUrl) return unavailable(sourceId, sourceLabel, 'SOURCE_REQUIRES_MANUAL_REVIEW: PARCEL_GIS_API_URL missing', queryUsed);

  const r = await fetchSourceJson(sourceUrl, { county, state, q: query }, fetchImpl);
  return makeSourceResult({ sourceId, sourceLabel, sourceUrl, queryUsed, status: r.status, errorDetail: r.errorDetail, data: r.data, confidence: r.status === SOURCE_STATUS.FOUND ? CONFIDENCE.POSSIBLE : CONFIDENCE.NOT_VERIFIED });
}

export async function countyClerkDeedIndexScraper({ county, state, query, queryType, fetchImpl = fetch, env = process.env }) {
  const sourceUrl = env.COUNTY_CLERK_API_URL;
  const sourceId = 'county_clerk_deed_index';
  const sourceLabel = 'County Clerk Deed Index';
  const queryUsed = JSON.stringify({ county, state, query, queryType });
  if (!sourceUrl) return unavailable(sourceId, sourceLabel, 'SOURCE_REQUIRES_MANUAL_REVIEW: COUNTY_CLERK_API_URL missing', queryUsed);

  const r = await fetchSourceJson(sourceUrl, { county, state, q: query, queryType }, fetchImpl);
  return makeSourceResult({ sourceId, sourceLabel, sourceUrl, queryUsed, status: r.status, errorDetail: r.errorDetail, data: r.data, confidence: r.status === SOURCE_STATUS.FOUND ? CONFIDENCE.LIKELY : CONFIDENCE.NOT_VERIFIED });
}

export async function grantorGranteeIndexScraper({ county, state, ownerName, parcelId, fetchImpl = fetch, env = process.env }) {
  const sourceUrl = env.GRANTOR_GRANTEE_API_URL;
  const sourceId = 'grantor_grantee_index';
  const sourceLabel = 'Grantor-Grantee Index';
  const queryUsed = JSON.stringify({ county, state, ownerName, parcelId });
  if (!sourceUrl) return unavailable(sourceId, sourceLabel, 'SOURCE_REQUIRES_MANUAL_REVIEW: GRANTOR_GRANTEE_API_URL missing', queryUsed);

  const r = await fetchSourceJson(sourceUrl, { county, state, ownerName, parcelId }, fetchImpl);
  return makeSourceResult({ sourceId, sourceLabel, sourceUrl, queryUsed, status: r.status, errorDetail: r.errorDetail, data: r.data, confidence: r.status === SOURCE_STATUS.FOUND ? CONFIDENCE.LIKELY : CONFIDENCE.NOT_VERIFIED });
}

export async function mortgageTrustDeedScraper({ county, state, parcelId, fetchImpl = fetch, env = process.env }) {
  const sourceUrl = env.MORTGAGE_INDEX_API_URL;
  const sourceId = 'mortgage_trust_deed';
  const sourceLabel = 'Mortgage / Trust Deed Index';
  const queryUsed = JSON.stringify({ county, state, parcelId });
  if (!sourceUrl) return unavailable(sourceId, sourceLabel, 'SOURCE_REQUIRES_MANUAL_REVIEW: MORTGAGE_INDEX_API_URL missing', queryUsed);

  const r = await fetchSourceJson(sourceUrl, { county, state, parcelId }, fetchImpl);
  return makeSourceResult({ sourceId, sourceLabel, sourceUrl, queryUsed, status: r.status, errorDetail: r.errorDetail, data: r.data, confidence: r.status === SOURCE_STATUS.FOUND ? CONFIDENCE.NOT_VERIFIED : CONFIDENCE.NOT_VERIFIED });
}

export function chainContinuityAnalyzer(instruments = []) {
  const chronologicalSequence = [...instruments].sort((a, b) => Date.parse(a.recordingDate || 0) - Date.parse(b.recordingDate || 0));
  const gaps = [];
  const conflictFlags = [];
  for (let i = 1; i < chronologicalSequence.length; i++) {
    const prev = chronologicalSequence[i - 1];
    const cur = chronologicalSequence[i];
    if (prev?.grantee && cur?.grantor && String(prev.grantee).toLowerCase() !== String(cur.grantor).toLowerCase()) {
      conflictFlags.push(`Chain mismatch between instrument ${prev.instrumentNumber || i} and ${cur.instrumentNumber || i + 1}`);
    }
  }
  if (!chronologicalSequence.length) gaps.push('No instruments were retrieved for continuity analysis.');
  return {
    chainStatus: conflictFlags.length ? 'gaps_or_conflicts' : 'likely_continuous',
    gaps,
    conflictFlags,
    chronologicalSequence
  };
}

export async function obituaryIndexScraper({ decedentName, county, state, deathYear, fetchImpl = fetch, env = process.env }) {
  const sourceUrl = env.OBITUARY_API_URL;
  const sourceId = 'obituary_index';
  const sourceLabel = 'Obituary Index';
  const queryUsed = JSON.stringify({ decedentName, county, state, deathYear });
  if (!sourceUrl) return unavailable(sourceId, sourceLabel, 'SOURCE_REQUIRES_MANUAL_REVIEW: OBITUARY_API_URL missing', queryUsed);

  const r = await fetchSourceJson(sourceUrl, { name: decedentName, county, state, deathYear }, fetchImpl);
  return makeSourceResult({ sourceId, sourceLabel, sourceUrl, queryUsed, status: r.status, errorDetail: r.errorDetail, data: r.data, confidence: r.status === SOURCE_STATUS.FOUND ? CONFIDENCE.POSSIBLE : CONFIDENCE.NOT_VERIFIED });
}

export async function probateCaseIndexScraper({ county, state, decedentName, deathYear, fetchImpl = fetch, env = process.env }) {
  const sourceUrl = env.PROBATE_API_URL;
  const sourceId = 'probate_case_index';
  const sourceLabel = 'Probate Case Index';
  const queryUsed = JSON.stringify({ county, state, decedentName, deathYear });
  if (!sourceUrl) return unavailable(sourceId, sourceLabel, 'SOURCE_REQUIRES_MANUAL_REVIEW: PROBATE_API_URL missing', queryUsed);

  const r = await fetchSourceJson(sourceUrl, { county, state, name: decedentName, deathYear }, fetchImpl);
  return makeSourceResult({ sourceId, sourceLabel, sourceUrl, queryUsed, status: r.status, errorDetail: r.errorDetail, data: r.data, confidence: r.status === SOURCE_STATUS.FOUND ? CONFIDENCE.LIKELY : CONFIDENCE.NOT_VERIFIED });
}

export async function publicPeopleAssociationLookup({ name, lastKnownAddress, relatedNames = [], fetchImpl = fetch, env = process.env }) {
  const licensed = String(env.PEOPLE_ASSOC_LICENSED || '').toLowerCase() === 'true';
  const sourceUrl = env.PEOPLE_ASSOC_API_URL;
  const sourceId = 'people_association_lookup';
  const sourceLabel = 'Licensed People Association Data';
  const queryUsed = JSON.stringify({ name, lastKnownAddress, relatedNames });

  if (!licensed) {
    return unavailable(sourceId, sourceLabel, 'SOURCE_REQUIRES_MANUAL_REVIEW: licensure flag PEOPLE_ASSOC_LICENSED is not true', queryUsed);
  }
  if (!sourceUrl) {
    return unavailable(sourceId, sourceLabel, 'SOURCE_REQUIRES_MANUAL_REVIEW: PEOPLE_ASSOC_API_URL missing', queryUsed);
  }

  const r = await fetchSourceJson(sourceUrl, { name, address: lastKnownAddress, related: relatedNames.join(',') }, fetchImpl);
  return makeSourceResult({ sourceId, sourceLabel, sourceUrl, queryUsed, status: r.status, errorDetail: r.errorDetail, data: r.data, confidence: r.status === SOURCE_STATUS.FOUND ? CONFIDENCE.POSSIBLE : CONFIDENCE.NOT_VERIFIED });
}

export function heirCandidateScorer(candidates = []) {
  return candidates.map((c) => {
    const score = Number(c.nameMatch || 0) + Number(c.locationMatch || 0) + Number(c.ageConsistency || 0) + Number(c.sourceCount || 0);
    let label = 'low-confidence';
    if (score >= 8) label = 'probable';
    else if (score >= 5) label = 'possible';
    return { ...c, score, label };
  });
}

export function crossSourceDiscrepancyAnalyzer(workflowResults) {
  const conflicts = [];
  const sources = workflowResults.sources || [];
  const ownerNames = sources
    .map((s) => s.data?.ownerName || s.data?.owner || s.data?.grantor || s.data?.grantee)
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());
  const uniqueOwners = [...new Set(ownerNames)];
  if (uniqueOwners.length > 1) conflicts.push('Owner name mismatches across queried sources.');

  return {
    conflicts,
    resolutions: [],
    unresolvedFlags: conflicts.length ? ['manual_owner_reconciliation_required'] : []
  };
}

export function confidenceMatrixBuilder(workflowResults) {
  const out = {
    stronglySupported: [],
    moderatelySupported: [],
    weakOrSpeculative: [],
    requiresManualValidation: []
  };

  for (const src of workflowResults.sources || []) {
    const item = { sourceId: src.sourceId, sourceLabel: src.sourceLabel, confidence: src.confidence, status: src.status };
    if (src.confidence === CONFIDENCE.CONFIRMED) out.stronglySupported.push(item);
    else if (src.confidence === CONFIDENCE.LIKELY) out.moderatelySupported.push(item);
    else if (src.confidence === CONFIDENCE.POSSIBLE) out.weakOrSpeculative.push(item);
    else out.requiresManualValidation.push(item);
  }

  return out;
}

export function recommendedNextStepsGenerator(discrepancies, confidenceMatrix) {
  const steps = [];
  if ((discrepancies?.conflicts || []).length) steps.push('Manual county clerk review');
  if ((confidenceMatrix?.requiresManualValidation || []).length) steps.push('Probate attorney review');
  if ((confidenceMatrix?.weakOrSpeculative || []).length) steps.push('Outreach verification before contact');
  if (!steps.length) steps.push('Obtain official deed copy');

  return {
    recommendations: [...new Set(steps)],
    disclaimer: 'These recommendations are investigative workflow suggestions only and do not constitute legal advice.'
  };
}
