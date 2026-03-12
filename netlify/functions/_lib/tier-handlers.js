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
  recommendedNextStepsGenerator
} from './source-modules.js';
import { REPORT_TIER } from './tier-mapping.js';
import { SOURCE_STATUS } from './workflow-results.js';
import { gatherPublicRecordIntel } from './public-records.js';

function requireConfiguredSources(keys, env = process.env) {
  const strict = String(env.PAID_FULFILLMENT_STRICT || 'true').toLowerCase() !== 'false';
  if (!strict) return;
  const missing = keys.filter((k) => !String(env[k] || '').trim());
  if (missing.length) throw new Error(`Missing required source configuration: ${missing.join(', ')}`);
}

function overallFromSources(sources) {
  if (sources.some((s) => s.status === SOURCE_STATUS.ERROR)) return 'failed';
  if (sources.some((s) => [SOURCE_STATUS.PARTIAL, SOURCE_STATUS.UNAVAILABLE, SOURCE_STATUS.BLOCKED].includes(s.status))) return 'partial';
  return 'complete';
}

function missingReasons(sources) {
  return sources
    .filter((s) => [SOURCE_STATUS.UNAVAILABLE, SOURCE_STATUS.BLOCKED, SOURCE_STATUS.ERROR].includes(s.status))
    .map((s) => `${s.sourceId}: ${s.errorDetail || s.status}`);
}

function mkWorkflow(order, tier, sources, extra = {}) {
  const startedAt = extra.startedAt || new Date().toISOString();
  const completedAt = new Date().toISOString();
  const overallStatus = overallFromSources(sources);
  const reasons = missingReasons(sources);
  return {
    orderId: order.order_id || order.caseRef,
    tier,
    startedAt,
    completedAt,
    inputs: order.input_criteria || { subjectName: order.subjectName, county: order.county, state: order.state, website: order.website, goals: order.goals },
    sources,
    overallStatus,
    partialReasons: overallStatus === 'partial' ? reasons : [],
    failureReasons: overallStatus === 'failed' ? reasons : [],
    ...extra
  };
}

export async function runStandardReport(order, ctx = {}) {
  requireConfiguredSources(['APPRAISAL_API_URL', 'TAX_COLLECTOR_API_URL', 'PARCEL_GIS_API_URL']);
  const county = order.county || order.input_criteria?.county || process.env.DEFAULT_COUNTY || '';
  const state = order.state || order.input_criteria?.state || process.env.DEFAULT_STATE || '';
  const query = order.subjectName || order.website || order.goals || '';

  const publicRecords = await gatherPublicRecordIntel({ packageKey: 'standard', input: { address: order.website || '', ownerName: order.subjectName || '', county, state } }, { fetchImpl: ctx.fetchImpl });

  const s1 = await appraisalDistrictScraper({ county, state, query, fetchImpl: ctx.fetchImpl });
  const parcelId = s1?.data?.parcelId || s1?.data?.apn || '';
  const s2 = await taxCollectorScraper({ county, state, parcelId, fetchImpl: ctx.fetchImpl });
  const s3 = await parcelGisLookup({ county, state, query, fetchImpl: ctx.fetchImpl });

  return mkWorkflow(order, 'standard', [...publicRecords.sources, s1, s2, s3], { startedAt: ctx.startedAt, publicRecords });
}

export async function runOwnershipEncumbranceReport(order, ctx = {}) {
  requireConfiguredSources(['APPRAISAL_API_URL', 'COUNTY_CLERK_API_URL', 'GRANTOR_GRANTEE_API_URL']);
  const county = order.county || order.input_criteria?.county || process.env.DEFAULT_COUNTY || '';
  const state = order.state || order.input_criteria?.state || process.env.DEFAULT_STATE || '';
  const query = order.subjectName || order.website || order.goals || '';

  const publicRecords = await gatherPublicRecordIntel({ packageKey: 'title_property', input: { address: order.website || '', ownerName: order.subjectName || '', county, state, parcel: order.parcelId || '' } }, { fetchImpl: ctx.fetchImpl });

  const s1 = await appraisalDistrictScraper({ county, state, query, fetchImpl: ctx.fetchImpl });
  const parcelId = s1?.data?.parcelId || s1?.data?.apn || '';
  const s2 = await countyClerkDeedIndexScraper({ county, state, query, queryType: 'parcel', fetchImpl: ctx.fetchImpl });
  const s3 = await grantorGranteeIndexScraper({ county, state, ownerName: order.subjectName, parcelId, fetchImpl: ctx.fetchImpl });
  const s4 = await mortgageTrustDeedScraper({ county, state, parcelId, fetchImpl: ctx.fetchImpl });

  const instruments = [];
  if (Array.isArray(s2.data?.instruments)) instruments.push(...s2.data.instruments);
  if (Array.isArray(s3.data?.instruments)) instruments.push(...s3.data.instruments);
  const chain = chainContinuityAnalyzer(instruments);

  return mkWorkflow(order, 'ownership_encumbrance', [...publicRecords.sources, s1, s2, s3, s4], { startedAt: ctx.startedAt, chainAnalysis: chain, publicRecords });
}

export async function runProbateHeirshipReport(order, ctx = {}) {
  requireConfiguredSources(['OBITUARY_API_URL', 'PROBATE_API_URL']);
  const county = order.county || order.input_criteria?.county || process.env.DEFAULT_COUNTY || '';
  const state = order.state || order.input_criteria?.state || process.env.DEFAULT_STATE || '';
  const decedentName = order.subjectName || '';

  const publicRecords = await gatherPublicRecordIntel({ packageKey: 'heir_location', input: { decedentName, ownerName: order.subjectName || '', county, state } }, { fetchImpl: ctx.fetchImpl });

  const s1 = await obituaryIndexScraper({ decedentName, county, state, deathYear: order.deathYear, fetchImpl: ctx.fetchImpl });
  const s2 = await probateCaseIndexScraper({ county, state, decedentName, deathYear: order.deathYear, fetchImpl: ctx.fetchImpl });
  const s3 = await publicPeopleAssociationLookup({ name: decedentName, lastKnownAddress: order.website || '', fetchImpl: ctx.fetchImpl });

  const candidates = Array.isArray(s3?.data?.candidates) ? s3.data.candidates : [];
  const scoredCandidates = heirCandidateScorer(candidates);

  return mkWorkflow(order, 'probate_heirship', [...publicRecords.sources, s1, s2, s3], { startedAt: ctx.startedAt, scoredCandidates, publicRecords });
}

export async function runAssetNetworkReport(order, ctx = {}) {
  requireConfiguredSources(['APPRAISAL_API_URL', 'COUNTY_CLERK_API_URL', 'GRANTOR_GRANTEE_API_URL', 'TAX_COLLECTOR_API_URL', 'PARCEL_GIS_API_URL']);
  const county = order.county || order.input_criteria?.county || process.env.DEFAULT_COUNTY || '';
  const state = order.state || order.input_criteria?.state || process.env.DEFAULT_STATE || '';
  const query = order.subjectName || order.website || order.goals || '';

  const publicRecords = await gatherPublicRecordIntel({ packageKey: 'title_property', input: { address: order.website || '', ownerName: order.subjectName || '', county, state } }, { fetchImpl: ctx.fetchImpl });

  const s1 = await appraisalDistrictScraper({ county, state, query, fetchImpl: ctx.fetchImpl });
  const parcelId = s1?.data?.parcelId || s1?.data?.apn || '';
  const s2 = await taxCollectorScraper({ county, state, parcelId, fetchImpl: ctx.fetchImpl });
  const s3 = await parcelGisLookup({ county, state, query, fetchImpl: ctx.fetchImpl });
  const s4 = await countyClerkDeedIndexScraper({ county, state, query, queryType: 'owner', fetchImpl: ctx.fetchImpl });
  const s5 = await grantorGranteeIndexScraper({ county, state, ownerName: order.subjectName, parcelId, fetchImpl: ctx.fetchImpl });

  const instruments = [];
  if (Array.isArray(s4.data?.instruments)) instruments.push(...s4.data.instruments);
  if (Array.isArray(s5.data?.instruments)) instruments.push(...s5.data.instruments);
  const chain = chainContinuityAnalyzer(instruments);

  return mkWorkflow(order, 'asset_network', [...publicRecords.sources, s1, s2, s3, s4, s5], { startedAt: ctx.startedAt, chainAnalysis: chain, publicRecords });
}

export async function runComprehensiveReport(order, ctx = {}) {
  const [standard, ownership, heirship] = await Promise.all([
    runStandardReport(order, ctx),
    runOwnershipEncumbranceReport(order, ctx),
    runProbateHeirshipReport(order, ctx)
  ]);

  const sources = [...standard.sources, ...ownership.sources, ...heirship.sources];
  const combined = mkWorkflow(order, 'comprehensive', sources, {
    startedAt: ctx.startedAt,
    publicRecords: { standard: standard.publicRecords, ownership: ownership.publicRecords, heirship: heirship.publicRecords }
  });
  const discrepancy = crossSourceDiscrepancyAnalyzer(combined);
  const confidenceMatrix = confidenceMatrixBuilder(combined);
  const nextSteps = recommendedNextStepsGenerator(discrepancy, confidenceMatrix);

  return {
    ...combined,
    discrepancy,
    confidenceMatrix,
    nextSteps
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
