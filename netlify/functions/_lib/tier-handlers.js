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
import { gatherOsint } from './osint.js';
import { resolveInvestigationInput } from './validation.js';

function requireConfiguredSources(keys, env = process.env) {
  const strict = String(env.PAID_FULFILLMENT_STRICT || 'true').toLowerCase() !== 'false';
  if (!strict) return;
  const missing = keys.filter((key) => !String(env[key] || '').trim());
  if (missing.length) throw new Error(`Missing required source configuration: ${missing.join(', ')}`);
}

function missingConfiguredSources(keys, env = process.env) {
  const strict = String(env.PAID_FULFILLMENT_STRICT || 'true').toLowerCase() !== 'false';
  if (!strict) return [];
  return keys.filter((key) => !String(env[key] || '').trim());
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

function shouldEnrichWithOsint(env = process.env) {
  return String(env.TRACEWORKS_ENABLE_OSINT_ENRICHMENT || 'true').toLowerCase() !== 'false';
}

function buildOsintQuery(input) {
  return [
    input.subjectName,
    input.lastKnownAddress,
    input.parcelId,
    input.county ? `${input.county} County` : '',
    input.state,
    ...(input.alternateNames || []).slice(0, 2)
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function gatherWorkflowOsint(order, input, packageId, ctx = {}) {
  const env = ctx.env || process.env;
  if (!shouldEnrichWithOsint(env) || ctx.skipOsint) return null;

  const query = buildOsintQuery(input);
  if (!query) return null;

  try {
    return await gatherOsint(query, {
      packageId,
      fetchImpl: ctx.fetchImpl,
      env,
      location: input.county && input.state ? `${input.county} County, ${input.state}, United States` : '',
      publicRecordOrder: null,
      orderId: order.order_id || order.caseRef
    });
  } catch (error) {
    return {
      packageId,
      query,
      queryPlan: [query],
      providerHealth: [],
      providerNote: `OSINT enrichment failed in this run: ${String(error?.message || error)}`,
      coverage: {
        totalSources: 0,
        totalOpenWebSources: 0,
        totalStructuredEvidence: 0,
        distinctDomains: 0,
        providersWithHits: 0
      },
      sources: [],
      evidence: []
    };
  }
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
  const env = ctx.env || process.env;
  const input = resolveInvestigationInput(order);
  const query = makePrimaryQuery(input);
  const missingModuleKeys = missingConfiguredSources(['APPRAISAL_API_URL', 'TAX_COLLECTOR_API_URL', 'PARCEL_GIS_API_URL'], env);

  const publicRecords = await gatherPublicRecordIntel(
    { packageKey: 'standard', input: makePublicRecordInput(input) },
    { fetchImpl: ctx.fetchImpl, env }
  );

  const primaryPropertyHit = Array.isArray(publicRecords?.findings?.property) ? publicRecords.findings.property[0] : null;
  const fallbackParcelId = input.parcelId
    || primaryPropertyHit?.parcelId
    || primaryPropertyHit?.apn
    || primaryPropertyHit?.parcel
    || primaryPropertyHit?.account
    || '';

  let workflowSources = [...(publicRecords.sources || [])];
  let parcelIdForOsint = fallbackParcelId;

  if (!missingModuleKeys.length) {
    const s1 = await appraisalDistrictScraper({ county: input.county, state: input.state, query, fetchImpl: ctx.fetchImpl, env });
    const parcelId = input.parcelId || s1?.data?.parcelId || s1?.data?.apn || fallbackParcelId;
    const s2 = await taxCollectorScraper({ county: input.county, state: input.state, parcelId, fetchImpl: ctx.fetchImpl, env });
    const s3 = await parcelGisLookup({ county: input.county, state: input.state, query: input.lastKnownAddress || query, fetchImpl: ctx.fetchImpl, env });
    workflowSources = [...workflowSources, s1, s2, s3];
    parcelIdForOsint = parcelId;
  } else if (!workflowSources.length) {
    requireConfiguredSources(['APPRAISAL_API_URL', 'TAX_COLLECTOR_API_URL', 'PARCEL_GIS_API_URL'], env);
  }

  const osint = await gatherWorkflowOsint(order, { ...input, parcelId: parcelIdForOsint }, 'standard', { ...ctx, env });

  return mkWorkflow(order, 'standard', workflowSources, input, {
    startedAt: ctx.startedAt,
    publicRecords,
    osint,
    moduleFallback: missingModuleKeys.length > 0 && workflowSources.length > 0,
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
  const osint = await gatherWorkflowOsint(order, { ...input, parcelId }, 'ownership_encumbrance', ctx);

  return mkWorkflow(order, 'ownership_encumbrance', [...publicRecords.sources, s1, s2, s3, s4], input, {
    startedAt: ctx.startedAt,
    chainAnalysis: chain,
    publicRecords,
    osint,
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
  const osint = await gatherWorkflowOsint(order, input, 'probate_heirship', ctx);

  return mkWorkflow(order, 'probate_heirship', [...publicRecords.sources, s1, s2, s3], input, {
    startedAt: ctx.startedAt,
    scoredCandidates,
    publicRecords,
    osint,
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
  const osint = await gatherWorkflowOsint(order, { ...input, parcelId }, 'asset_network', ctx);

  return mkWorkflow(order, 'asset_network', [...publicRecords.sources, s1, s2, s3, s4, s5], input, {
    startedAt: ctx.startedAt,
    chainAnalysis: chain,
    publicRecords,
    osint,
  });
}

export async function runComprehensiveReport(order, ctx = {}) {
  const [standard, ownership, heirship] = await Promise.all([
    runStandardReport(order, { ...ctx, skipOsint: true }),
    runOwnershipEncumbranceReport(order, { ...ctx, skipOsint: true }),
    runProbateHeirshipReport(order, { ...ctx, skipOsint: true }),
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
  const osint = await gatherWorkflowOsint(order, input, 'comprehensive', ctx);

  return {
    ...combined,
    discrepancy,
    confidenceMatrix,
    nextSteps,
    osint,
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
