import { CONFIDENCE, makeSourceResult, SOURCE_STATUS } from './workflow-results.js';
import { searchCountyProperty } from './sources/county-property.js';
import { searchCountyRecorder } from './sources/county-recorder.js';
import { searchEntityRegistry } from './sources/entity-search.js';
import { searchProbateIndex } from './sources/probate-index.js';
import { loadSourceConfig } from './sources/source-config.js';
import { canonicalPackageId, packageSupportsPublicRecordFamily, publicRecordFamiliesForPackage } from './package-contract.js';

function isStrict(env = process.env) {
  return String(env.PAID_FULFILLMENT_STRICT || 'true').toLowerCase() !== 'false';
}

function requireConfigs(configs, name, env) {
  if (!configs.length && isStrict(env)) {
    throw new Error(`Missing required public record source configuration for ${name}. Provide PUBLIC_RECORD_SOURCE_CONFIG.`);
  }
}

function hasConfigs(configs) {
  return Array.isArray(configs) && configs.length > 0;
}

function missingConfigGap(name) {
  return `No ${name} sources are configured for this runtime.`;
}

function evidenceToSourceResult(evidence, dataRows = []) {
  let status = SOURCE_STATUS.NOT_FOUND;
  if (evidence.status === 'found') status = SOURCE_STATUS.FOUND;
  if (evidence.status === 'skipped') status = SOURCE_STATUS.SKIPPED;
  if (evidence.status === 'blocked') status = SOURCE_STATUS.BLOCKED;
  if (evidence.status === 'unavailable') status = SOURCE_STATUS.UNAVAILABLE;
  if (evidence.status === 'error') status = SOURCE_STATUS.ERROR;

  return makeSourceResult({
    sourceId: evidence.sourceId,
    sourceLabel: evidence.sourceName,
    sourceUrl: evidence.url,
    queryUsed: JSON.stringify(evidence.query || {}),
    status,
    data: dataRows,
    confidence: status === SOURCE_STATUS.FOUND ? CONFIDENCE.LIKELY : CONFIDENCE.NOT_VERIFIED,
    errorDetail: evidence.notes || null
  });
}

function buildHealthSummary(evidence = []) {
  const summary = { attempted: evidence.length, found: 0, notFound: 0, skipped: 0, blocked: 0, unavailable: 0, error: 0 };
  for (const item of evidence) {
    if (item.status === 'found') summary.found += 1;
    else if (item.status === 'skipped') summary.skipped += 1;
    else if (item.status === 'blocked') summary.blocked += 1;
    else if (item.status === 'unavailable') summary.unavailable += 1;
    else if (item.status === 'error') summary.error += 1;
    else summary.notFound += 1;
  }
  return summary;
}

function pushEvidence(payload, out) {
  payload.evidence.push(...out.evidence);
  for (const e of out.evidence) {
    payload.sources.push(evidenceToSourceResult(e, out.results));
  }
}

function familyGap(results = [], evidence = [], { noResult, allSkipped }) {
  if (results.length) return '';
  if (evidence.length && evidence.every((item) => item.status === 'skipped')) return allSkipped;
  return noResult;
}

export async function gatherPublicRecordIntel(order, { fetchImpl = fetch, env = process.env } = {}) {
  const packageKey = canonicalPackageId(order.packageKey || order.packageId || 'standard') || 'standard';
  const input = order.input || order.input_criteria || {
    address: order.websiteProfile || order.website || '',
    ownerName: order.subjectName || '',
    decedentName: order.subjectName || '',
    entityName: '',
    county: order.county || '',
    state: order.state || ''
  };
  const requestedFamilies = publicRecordFamiliesForPackage(packageKey);

  const sourceConfig = loadSourceConfig(env);

  const payload = {
    packageKey,
    canonicalPackageKey: packageKey,
    requestedFamilies,
    executedFamilies: [],
    findings: {},
    evidence: [],
    gaps: [],
    sources: [],
    sourceHealth: { attempted: 0, found: 0, notFound: 0, skipped: 0, blocked: 0, unavailable: 0, error: 0 }
  };

  if (packageSupportsPublicRecordFamily(packageKey, 'countyProperty')) {
    requireConfigs(sourceConfig.countyProperty, 'countyProperty', env);
    if (!hasConfigs(sourceConfig.countyProperty)) {
      payload.gaps.push(missingConfigGap('county property'));
    } else {
      payload.executedFamilies.push('countyProperty');
      const propertyOut = await searchCountyProperty({
        county: input.county,
        state: input.state,
        address: input.address,
        owner: input.ownerName,
        parcel: input.parcel,
        configs: sourceConfig.countyProperty,
        fetchImpl
      });
      payload.findings.property = propertyOut.results;
      pushEvidence(payload, propertyOut);

      const propertyGap = familyGap(propertyOut.results, propertyOut.evidence, {
        noResult: 'No county property results found',
        allSkipped: 'No county property sources were in scope for the supplied identifiers or jurisdiction.'
      });
      if (propertyGap) payload.gaps.push(propertyGap);
    }
  }

  if (packageSupportsPublicRecordFamily(packageKey, 'countyRecorder')) {
    requireConfigs(sourceConfig.countyRecorder, 'countyRecorder', env);
    if (!hasConfigs(sourceConfig.countyRecorder)) {
      payload.gaps.push(missingConfigGap('county recorder'));
    } else {
      payload.executedFamilies.push('countyRecorder');
      const recorderOut = await searchCountyRecorder({
        county: input.county,
        state: input.state,
        owner: input.ownerName,
        address: input.address,
        parcel: input.parcel,
        configs: sourceConfig.countyRecorder,
        fetchImpl
      });
      payload.findings.recorder = recorderOut.results;
      pushEvidence(payload, recorderOut);

      const recorderGap = familyGap(recorderOut.results, recorderOut.evidence, {
        noResult: 'No county recorder results found',
        allSkipped: 'No county recorder sources were in scope for the supplied identifiers or jurisdiction.'
      });
      if (recorderGap) payload.gaps.push(recorderGap);
    }
  }

  if (packageSupportsPublicRecordFamily(packageKey, 'probateIndex')) {
    requireConfigs(sourceConfig.probateIndex, 'probateIndex', env);
    if (!hasConfigs(sourceConfig.probateIndex)) {
      payload.gaps.push(missingConfigGap('probate index'));
    } else {
      payload.executedFamilies.push('probateIndex');
      const probateOut = await searchProbateIndex({
        decedent: input.decedentName || input.ownerName,
        county: input.county,
        state: input.state,
        configs: sourceConfig.probateIndex,
        fetchImpl
      });

      payload.findings.probate = probateOut.results;
      pushEvidence(payload, probateOut);
      const probateGap = familyGap(probateOut.results, probateOut.evidence, {
        noResult: 'No probate index results found',
        allSkipped: 'No probate index sources were in scope for the supplied identifiers or jurisdiction.'
      });
      if (probateGap) payload.gaps.push(probateGap);
    }
  }

  if (packageSupportsPublicRecordFamily(packageKey, 'entitySearch') && input.entityName) {
    if (!hasConfigs(sourceConfig.entitySearch)) {
      payload.gaps.push('Entity registry enrichment is not configured for this runtime.');
    } else {
      payload.executedFamilies.push('entitySearch');
      const entityOut = await searchEntityRegistry({
        entityName: input.entityName,
        state: input.state,
        configs: sourceConfig.entitySearch,
        fetchImpl
      });
      payload.findings.entity = entityOut.results;
      pushEvidence(payload, entityOut);
      const entityGap = familyGap(entityOut.results, entityOut.evidence, {
        noResult: 'No entity registry results found',
        allSkipped: 'No entity registry sources were in scope for the supplied identifiers or jurisdiction.'
      });
      if (entityGap) payload.gaps.push(entityGap);
    }
  }

  payload.sourceHealth = buildHealthSummary(payload.evidence);
  return payload;
}
