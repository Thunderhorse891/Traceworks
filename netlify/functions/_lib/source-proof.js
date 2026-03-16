import { assessSourceProofGate } from './launch-audit.js';
import { gatherOsint } from './osint.js';
import { getPackage } from './packages.js';
import { buildInputCriteria, normalizeCheckoutPayload, validateCheckoutPayload } from './validation.js';

function clean(value) {
  return String(value || '').trim();
}

function normalizeProofPayload(raw = {}) {
  return normalizeCheckoutPayload({
    packageId: raw.packageId,
    customerName: 'TraceWorks Ops',
    customerEmail: 'ops@traceworks.example',
    subjectName: raw.subjectName,
    subjectType: raw.subjectType,
    county: raw.county,
    state: raw.state,
    lastKnownAddress: raw.lastKnownAddress,
    websiteProfile: raw.websiteProfile,
    parcelId: raw.parcelId,
    alternateNames: raw.alternateNames,
    dateOfBirth: raw.dateOfBirth,
    deathYear: raw.deathYear,
    subjectPhone: raw.subjectPhone,
    subjectEmail: raw.subjectEmail,
    requestedFindings: raw.requestedFindings,
    goals: raw.goals,
    legalConsent: true,
    tosConsent: true
  });
}

function buildProofQuery(criteria) {
  return [
    criteria.subjectName,
    criteria.lastKnownAddress,
    criteria.parcelId,
    criteria.county,
    criteria.state
  ].filter(Boolean).join(' ');
}

function buildPublicRecordOrder(packageId, criteria) {
  return {
    packageId,
    packageKey: packageId,
    input: {
      address: criteria.lastKnownAddress,
      ownerName: criteria.subjectName,
      decedentName: criteria.subjectName,
      entityName: criteria.subjectType === 'entity' ? criteria.subjectName : '',
      county: criteria.county,
      state: criteria.state,
      parcel: criteria.parcelId
    }
  };
}

function summarizeProof(result, gate) {
  const publicRecords = result.publicRecords || {};
  return {
    totalSources: result.coverage?.totalSources || 0,
    totalOpenWebSources: result.coverage?.totalOpenWebSources || 0,
    totalStructuredEvidence: result.coverage?.totalStructuredEvidence || 0,
    providersWithHits: result.coverage?.providersWithHits || 0,
    distinctDomains: result.coverage?.distinctDomains || 0,
    publicRecordFamiliesRequested: publicRecords.requestedFamilies || [],
    publicRecordFamiliesExecuted: publicRecords.executedFamilies || [],
    publicRecordHealth: publicRecords.sourceHealth || null,
    publicRecordGaps: publicRecords.gaps || [],
    manualReviewLikely: Boolean(gate.manualReviewLikely),
    manualReviewDetails: gate.manualReviewDetails || []
  };
}

export async function runSourceProof(rawPayload, { fetchImpl = fetch, env = process.env, deps = {} } = {}) {
  const startedAt = new Date().toISOString();
  const payload = normalizeProofPayload(rawPayload);
  const pkg = getPackage(payload.packageId);

  if (!pkg) {
    return { ok: false, startedAt, errors: ['Invalid package selected.'] };
  }

  const errors = validateCheckoutPayload(payload).filter((message) => !message.startsWith('Terms consent') && !message.startsWith('Legal use acknowledgement'));
  if (errors.length) {
    return { ok: false, startedAt, packageId: payload.packageId, errors };
  }

  const inputCriteria = buildInputCriteria(payload);
  const evaluateOrderGate = deps.assessSourceProofGateImpl || assessSourceProofGate;
  const gate = evaluateOrderGate(payload.packageId, inputCriteria, env);
  if (!gate.launchReady) {
    return {
      ok: false,
      startedAt,
      packageId: payload.packageId,
      launchBlocked: true,
      launchMessage: gate.launchMessage,
      blockingAreas: gate.launchBlockingAreas,
      blockingDetails: gate.launchBlockingDetails,
      orderCoverage: gate.orderCoverage,
      input: inputCriteria
    };
  }

  const query = clean(rawPayload.query) || buildProofQuery(inputCriteria);
  const gatherOsintImpl = deps.gatherOsintImpl || gatherOsint;
  const result = await gatherOsintImpl(query, {
    fetchImpl,
    env,
    packageId: payload.packageId,
    publicRecordOrder: buildPublicRecordOrder(payload.packageId, inputCriteria)
  });

  const completedAt = new Date().toISOString();
  const summary = summarizeProof(result, gate);

  return {
    ok: true,
    startedAt,
    completedAt,
    packageId: payload.packageId,
    packageName: pkg.name,
    input: inputCriteria,
    query,
    orderCoverage: gate.orderCoverage,
    summary,
    providerHealth: result.providerHealth || [],
    providerNote: result.providerNote || '',
    topSources: Array.isArray(result.sources) ? result.sources.slice(0, 8) : [],
    publicRecords: result.publicRecords || null
  };
}
