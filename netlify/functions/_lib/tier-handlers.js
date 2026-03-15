import {
  appraisalDistrictScraper,
  taxCollectorScraper,
  parcelGisLookup,
  countyClerkDeedIndexScraper,
  grantorGranteeIndexScraper,
  mortgageTrustDeedScraper,
  chainContinuityAnalyzer,
  obituaryIndexScraper,
  probateCaseIndexScraper,
  publicPeopleAssociationLookup,
  heirCandidateScorer,
  crossSourceDiscrepancyAnalyzer,
  confidenceMatrixBuilder,
  recommendedNextStepsGenerator,
} from './source-modules.js';
import { REPORT_TIER } from './tier-mapping.js';
import { SOURCE_STATUS } from './workflow-results.js';
import { gatherPublicRecordIntel } from './public-records.js';
import { resolveInvestigationInput } from './validation.js';

function requireConfiguredSources(keys, env = process.env) {
  const strict = String(env.PAID_FULFILLMENT_STRICT || 'true').toLowerCase() !== 'false';
  if (!strict) return;
  const missing = keys.filter((key) => !String(env[key] || '').trim());
  if (missing.length) throw new Error(`Missing required source configuration: ${missing.join(', ')}`);
}

function overallFromSources(sources) {
  if (sources.some((source) => source.status === SOURCE_STATUS.ERROR)) return 'failed';
  if (sources.some((source) => [SOURCE_STATUS.PARTIAL, SOURCE_STATUS.UNAVAILABLE, SOURCE_STATUS.BLOCKED].includes(source.status))) return 'partial';
  return 'complete';
}

function missingReasons(sources) {
  return sources
    .filter((source) => [SOURCE_STATUS.UNAVAILABLE, SOURCE_STATUS.BLOCKED, SOURCE_STATUS.ERROR].includes(source.status))
    .map((source) => `${source.sourceId}: ${source.errorDetail || source.status}`);
}

function makePrimaryQuery(input) {
  return input.parcelId || input.lastKnownAddress || input.subjectName || input.searchSeeds?.[0] || input.goals || '';
}

function makePublicRecordInput(input) {
  return {
    address: input.lastKnownAddress,
    ownerName: input.subjectName || '',
    decedentName: input.subjectName || '',
    entityName: input.subjectType === 'entity' ? input.subjectName : '',
    parcel: input.parcelId || '',
    county: input.county,
    state: input.state,
  };
}

function mkWorkflow(order, tier, sources, input, extra = {}) {
  const startedAt = extra.startedAt || new Date().toISOString();
  const completedAt = new Date().toISOString();
  const overallStatus = overallFromSources(sources);
  const reasons = missingReasons(sources);
  return {
    orderId: order.order_id || order.caseRef,
    tier,
    startedAt,
    completedAt,
    inputs: input,
    sources,
    overallStatus,
    partialReasons: overallStatus === 'partial' ? reasons : [],
    failureReasons: overallStatus === 'failed' ? reasons : [],
    ...extra,
  };
}

export async function runStandardReport(order, ctx = {}) {
  requireConfiguredSources(['APPRAISAL_API_URL', 'TAX_COLLECTOR_API_URL', 'PARCEL_GIS_API_URL']);
  const input = resolveInvestigationInput(order);
  const query = makePrimaryQuery(input);

  const publicRecords = await gatherPublicRecordIntel(
    { packageKey: 'standard', input: makePublicRecordInput(input) },
    { fetchImpl: ctx.fetchImpl }
  );

  const s1 = await appraisalDistrictScraper({ county: input.county, state: input.state, query, fetchImpl: ctx.fetchImpl });
  const parcelId = input.parcelId || s1?.data?.parcelId || s1?.data?.apn || '';
  const s2 = await taxCollectorScraper({ county: input.county, state: input.state, parcelId, fetchImpl: ctx.fetchImpl });
  const s3 = await parcelGisLookup({ county: input.county, state: input.state, query: input.lastKnownAddress || query, fetchImpl: ctx.fetchImpl });

  return mkWorkflow(order, 'standard', [...publicRecords.sources, s1, s2, s3], input, {
    startedAt: ctx.startedAt,
    publicRecords,
  });
}

export async function runOwnershipEncumbranceReport(order, ctx = {}) {
  requireConfiguredSources(['APPRAISAL_API_URL', 'COUNTY_CLERK_API_URL', 'GRANTOR_GRANTEE_API_URL']);
  const input = resolveInvestigationInput(order);
  const query = makePrimaryQuery(input);

  const publicRecords = await gatherPublicRecordIntel(
    { packageKey: 'ownership_encumbrance', input: makePublicRecordInput(input) },
    { fetchImpl: ctx.fetchImpl }
  );

  const s1 = await appraisalDistrictScraper({ county: input.county, state: input.state, query, fetchImpl: ctx.fetchImpl });
  const parcelId = input.parcelId || s1?.data?.parcelId || s1?.data?.apn || '';
  const deedQuery = input.lastKnownAddress || parcelId || input.subjectName || query;
  const deedQueryType = input.lastKnownAddress || parcelId ? 'parcel' : 'owner';
  const s2 = await countyClerkDeedIndexScraper({
    county: input.county,
    state: input.state,
    query: deedQuery,
    queryType: deedQueryType,
    fetchImpl: ctx.fetchImpl,
  });
  const s3 = await grantorGranteeIndexScraper({
    county: input.county,
    state: input.state,
    ownerName: input.subjectName,
    parcelId,
    fetchImpl: ctx.fetchImpl,
  });
  const s4 = await mortgageTrustDeedScraper({ county: input.county, state: input.state, parcelId, fetchImpl: ctx.fetchImpl });

  const instruments = [];
  if (Array.isArray(s2.data?.instruments)) instruments.push(...s2.data.instruments);
  if (Array.isArray(s3.data?.instruments)) instruments.push(...s3.data.instruments);
  const chain = chainContinuityAnalyzer(instruments);

  return mkWorkflow(order, 'ownership_encumbrance', [...publicRecords.sources, s1, s2, s3, s4], input, {
    startedAt: ctx.startedAt,
    chainAnalysis: chain,
    publicRecords,
  });
}

export async function runProbateHeirshipReport(order, ctx = {}) {
  requireConfiguredSources(['OBITUARY_API_URL', 'PROBATE_API_URL']);
  const input = resolveInvestigationInput(order);
  const decedentName = input.subjectName || '';

  const publicRecords = await gatherPublicRecordIntel(
    { packageKey: 'probate_heirship', input: makePublicRecordInput({ ...input, subjectName: decedentName }) },
    { fetchImpl: ctx.fetchImpl }
  );

  const s1 = await obituaryIndexScraper({
    decedentName,
    county: input.county,
    state: input.state,
    deathYear: input.deathYear,
    fetchImpl: ctx.fetchImpl,
  });
  const s2 = await probateCaseIndexScraper({
    county: input.county,
    state: input.state,
    decedentName,
    deathYear: input.deathYear,
    fetchImpl: ctx.fetchImpl,
  });
  const s3 = await publicPeopleAssociationLookup({
    name: decedentName,
    lastKnownAddress: input.lastKnownAddress,
    relatedNames: input.alternateNames,
    fetchImpl: ctx.fetchImpl,
  });

  const candidates = Array.isArray(s3?.data?.candidates) ? s3.data.candidates : [];
  const scoredCandidates = heirCandidateScorer(candidates);

  return mkWorkflow(order, 'probate_heirship', [...publicRecords.sources, s1, s2, s3], input, {
    startedAt: ctx.startedAt,
    scoredCandidates,
    publicRecords,
  });
}

export async function runAssetNetworkReport(order, ctx = {}) {
  requireConfiguredSources(['APPRAISAL_API_URL', 'COUNTY_CLERK_API_URL', 'GRANTOR_GRANTEE_API_URL', 'TAX_COLLECTOR_API_URL', 'PARCEL_GIS_API_URL']);
  const input = resolveInvestigationInput(order);
  const query = makePrimaryQuery(input);

  const publicRecords = await gatherPublicRecordIntel(
    { packageKey: 'asset_network', input: makePublicRecordInput(input) },
    { fetchImpl: ctx.fetchImpl }
  );

  const s1 = await appraisalDistrictScraper({ county: input.county, state: input.state, query, fetchImpl: ctx.fetchImpl });
  const parcelId = input.parcelId || s1?.data?.parcelId || s1?.data?.apn || '';
  const s2 = await taxCollectorScraper({ county: input.county, state: input.state, parcelId, fetchImpl: ctx.fetchImpl });
  const s3 = await parcelGisLookup({ county: input.county, state: input.state, query: input.lastKnownAddress || query, fetchImpl: ctx.fetchImpl });
  const s4 = await countyClerkDeedIndexScraper({
    county: input.county,
    state: input.state,
    query: input.lastKnownAddress || input.subjectName || query,
    queryType: input.lastKnownAddress || parcelId ? 'parcel' : 'owner',
    fetchImpl: ctx.fetchImpl,
  });
  const s5 = await grantorGranteeIndexScraper({
    county: input.county,
    state: input.state,
    ownerName: input.subjectName,
    parcelId,
    fetchImpl: ctx.fetchImpl,
  });

  const instruments = [];
  if (Array.isArray(s4.data?.instruments)) instruments.push(...s4.data.instruments);
  if (Array.isArray(s5.data?.instruments)) instruments.push(...s5.data.instruments);
  const chain = chainContinuityAnalyzer(instruments);

  return mkWorkflow(order, 'asset_network', [...publicRecords.sources, s1, s2, s3, s4, s5], input, {
    startedAt: ctx.startedAt,
    chainAnalysis: chain,
    publicRecords,
  });
}

export async function runComprehensiveReport(order, ctx = {}) {
  const [standard, ownership, heirship] = await Promise.all([
    runStandardReport(order, ctx),
    runOwnershipEncumbranceReport(order, ctx),
    runProbateHeirshipReport(order, ctx),
  ]);

  const input = resolveInvestigationInput(order);
  const sources = [...standard.sources, ...ownership.sources, ...heirship.sources];
  const combined = mkWorkflow(order, 'comprehensive', sources, input, {
    startedAt: ctx.startedAt,
    publicRecords: {
      standard: standard.publicRecords,
      ownership: ownership.publicRecords,
      heirship: heirship.publicRecords,
    },
  });
  const discrepancy = crossSourceDiscrepancyAnalyzer(combined);
  const confidenceMatrix = confidenceMatrixBuilder(combined);
  const nextSteps = recommendedNextStepsGenerator(discrepancy, confidenceMatrix);

  return {
    ...combined,
    discrepancy,
    confidenceMatrix,
    nextSteps,
  };
}

export function tierRunnerFor(purchasedTier) {
  if (purchasedTier === REPORT_TIER.STANDARD_REPORT) return runStandardReport;
  if (purchasedTier === REPORT_TIER.OWNERSHIP_ENCUMBRANCE_REPORT) return runOwnershipEncumbranceReport;
  if (purchasedTier === REPORT_TIER.PROBATE_HEIRSHIP_REPORT) return runProbateHeirshipReport;
  if (purchasedTier === REPORT_TIER.ASSET_NETWORK_REPORT) return runAssetNetworkReport;
  if (purchasedTier === REPORT_TIER.COMPREHENSIVE_REPORT) return runComprehensiveReport;
  throw new Error(`No workflow handler configured for purchased tier: ${purchasedTier}`);
}
