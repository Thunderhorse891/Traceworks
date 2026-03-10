import { CONFIDENCE, makeSourceResult, SOURCE_STATUS } from './workflow-results.js';
import { searchCountyProperty } from './sources/county-property.js';
import { searchCountyRecorder } from './sources/county-recorder.js';
import { searchEntityRegistry } from './sources/entity-search.js';
import { searchProbateIndex } from './sources/probate-index.js';
import { loadSourceConfig } from './sources/source-config.js';

function isStrict(env = process.env) {
  return String(env.PAID_FULFILLMENT_STRICT || 'true').toLowerCase() !== 'false';
}

function requireConfigs(configs, name, env) {
  if (!configs.length && isStrict(env)) {
    throw new Error(`Missing required public record source configuration for ${name}. Provide PUBLIC_RECORD_SOURCE_CONFIG.`);
  }
}

function evidenceToSourceResult(evidence, dataRows = []) {
  const status = evidence.status === 'found' ? SOURCE_STATUS.FOUND : SOURCE_STATUS.NOT_FOUND;
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

function pushEvidence(payload, out) {
  payload.evidence.push(...out.evidence);
  for (const e of out.evidence) {
    payload.sources.push(evidenceToSourceResult(e, out.results));
  }
}

export async function gatherPublicRecordIntel(order, { fetchImpl = fetch, env = process.env } = {}) {
  const packageKey = String(order.packageKey || '').toLowerCase();
  const input = order.input || order.input_criteria || {
    address: order.website || '',
    ownerName: order.subjectName || '',
    decedentName: order.subjectName || '',
    entityName: ''
  };

  const sourceConfig = loadSourceConfig(env);

  const payload = {
    packageKey,
    findings: {},
    evidence: [],
    gaps: [],
    sources: []
  };

  if (['title', 'title_property', 'comprehensive', 'standard', 'locate'].includes(packageKey)) {
    requireConfigs(sourceConfig.countyProperty, 'countyProperty', env);
    requireConfigs(sourceConfig.countyRecorder, 'countyRecorder', env);

    const propertyOut = await searchCountyProperty({
      address: input.address,
      owner: input.ownerName,
      parcel: input.parcel,
      configs: sourceConfig.countyProperty,
      fetchImpl
    });
    payload.findings.property = propertyOut.results;
    pushEvidence(payload, propertyOut);

    const recorderOut = await searchCountyRecorder({
      owner: input.ownerName,
      address: input.address,
      parcel: input.parcel,
      configs: sourceConfig.countyRecorder,
      fetchImpl
    });
    payload.findings.recorder = recorderOut.results;
    pushEvidence(payload, recorderOut);

    if (!propertyOut.results.length) payload.gaps.push('No county property results found');
    if (!recorderOut.results.length) payload.gaps.push('No county recorder results found');
  }

  if (['heir', 'heir_location', 'comprehensive'].includes(packageKey)) {
    requireConfigs(sourceConfig.probateIndex, 'probateIndex', env);
    const probateOut = await searchProbateIndex({
      decedent: input.decedentName || input.ownerName,
      county: input.county,
      state: input.state,
      configs: sourceConfig.probateIndex,
      fetchImpl
    });

    payload.findings.probate = probateOut.results;
    pushEvidence(payload, probateOut);
    if (!probateOut.results.length) payload.gaps.push('No probate index results found');
  }

  if (input.entityName) {
    requireConfigs(sourceConfig.entitySearch, 'entitySearch', env);
    const entityOut = await searchEntityRegistry({
      entityName: input.entityName,
      configs: sourceConfig.entitySearch,
      fetchImpl
    });
    payload.findings.entity = entityOut.results;
    pushEvidence(payload, entityOut);
    if (!entityOut.results.length) payload.gaps.push('No entity registry results found');
  }

  return payload;
}
