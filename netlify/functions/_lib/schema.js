/**
 * TraceWorks data schemas.
 * Every source module returns a SourceResult.
 * Every workflow returns a WorkflowResults.
 * The report builder only renders from WorkflowResults — never infers data.
 */

export const CONFIDENCE = {
  confirmed: '[CONFIRMED]',
  likely: '[LIKELY]',
  possible: '[POSSIBLE]',
  conflicting: '[CONFLICTING]',
  not_verified: '[NOT VERIFIED]',
  not_found: '[NOT FOUND]',
  unavailable: '[SOURCE UNAVAILABLE]',
  manual_review: '[MANUAL REVIEW REQUIRED]'
};

export function makeSourceResult({
  sourceId,
  sourceLabel,
  sourceUrl,
  queryUsed,
  status,
  data = null,
  confidence = 'not_verified',
  errorDetail = null,
  queriedAt = new Date().toISOString(),
  screenshot = null,
  rawHtml = null
}) {
  if (status === 'found' && !data) {
    throw new Error(`SourceResult '${sourceId}': status='found' requires non-null data`);
  }
  return {
    sourceId: String(sourceId),
    sourceLabel: String(sourceLabel),
    sourceUrl: String(sourceUrl),
    queryUsed: String(queryUsed),
    queriedAt: String(queriedAt),
    status,
    errorDetail: errorDetail ? String(errorDetail) : null,
    data,
    confidence,
    screenshot,
    rawHtml
  };
}

export function makeWorkflowResults({
  orderId,
  tier,
  inputs,
  sources = [],
  heirCandidates = [],
  startedAt,
  completedAt = new Date().toISOString()
}) {
  const found = sources.filter((source) => source.status === 'found').length;
  const partial = sources.filter((source) => source.status === 'partial').length;
  const notFound = sources.filter((source) => source.status === 'not_found').length;
  const unavailable = sources.filter((source) => source.status === 'unavailable' || source.status === 'blocked').length;
  const errors = sources.filter((source) => source.status === 'error').length;

  let overallStatus = 'complete';
  const partialReasons = [];
  const failureReasons = [];

  if (found === 0 && sources.length > 0) {
    overallStatus = errors === sources.length ? 'failed' : 'partial';
    failureReasons.push('No sources returned found status');
  } else if (partial > 0 || unavailable > 0 || errors > 0) {
    overallStatus = 'partial';
    if (partial) partialReasons.push(`${partial} source(s) returned partial results`);
    if (unavailable) partialReasons.push(`${unavailable} source(s) unavailable`);
    if (errors) partialReasons.push(`${errors} source(s) errored`);
  }

  return {
    orderId: String(orderId),
    tier: String(tier),
    startedAt: String(startedAt || completedAt),
    completedAt,
    inputs,
    sources,
    overallStatus,
    partialReasons: partialReasons.length ? partialReasons : undefined,
    failureReasons: failureReasons.length ? failureReasons : undefined,
    heirCandidates,
    sourceSummary: { total: sources.length, found, partial, notFound, unavailable, errors }
  };
}

const FORBIDDEN_PHRASES = [
  'clear title',
  'title is clean',
  'verified heir',
  'guaranteed owner',
  'complete lien search',
  'all heirs found',
  'definitive legal ownership',
  'no liens exist',
  'all properties found',
  'complete asset picture'
];

export function scanForForbiddenPhrases(text) {
  const lower = String(text || '').toLowerCase();
  return FORBIDDEN_PHRASES.filter((phrase) => lower.includes(phrase));
}
