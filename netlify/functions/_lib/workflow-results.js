export const SOURCE_STATUS = {
  FOUND: 'found',
  PARTIAL: 'partial',
  NOT_FOUND: 'not_found',
  UNAVAILABLE: 'unavailable',
  BLOCKED: 'blocked',
  ERROR: 'error'
};

export const CONFIDENCE = {
  CONFIRMED: 'confirmed',
  LIKELY: 'likely',
  POSSIBLE: 'possible',
  CONFLICTING: 'conflicting',
  NOT_VERIFIED: 'not_verified'
};

export function makeSourceResult({
  sourceId,
  sourceLabel,
  sourceUrl,
  queryUsed,
  status,
  data = null,
  confidence = CONFIDENCE.NOT_VERIFIED,
  errorDetail = null,
  screenshot = null,
  rawHtml = null
}) {
  return {
    sourceId,
    sourceLabel,
    sourceUrl,
    queryUsed,
    queriedAt: new Date().toISOString(),
    status,
    errorDetail,
    data,
    confidence,
    screenshot,
    rawHtml
  };
}
