const OPTIONAL_OPEN_WEB_BLOCKING_IDS = new Set([
  'PEOPLE_ASSOC_LICENSED',
  'PEOPLE_ASSOC_API_URL'
]);

const OPTIONAL_OPEN_WEB_PACKAGES = new Set([
  'probate_heirship',
  'comprehensive'
]);

const CUSTOMER_SAFE_REPLACEMENTS = [
  {
    pattern: /\bManual review is required\./gi,
    replacement: 'TraceWorks flagged this source for internal follow-up. No customer action is required.'
  },
  {
    pattern: /\brequire manual retrieval\b/gi,
    replacement: 'require internal retrieval by TraceWorks'
  },
  {
    pattern: /\bmanual retrieval\b/gi,
    replacement: 'internal retrieval by TraceWorks'
  },
  {
    pattern: /\ba manual review step is required before delivery\b/gi,
    replacement: 'TraceWorks flagged this report for internal follow-up before delivery. No customer action is required'
  }
];

function dedupeManualReviewDetails(details = []) {
  const seen = new Set();
  const out = [];
  for (const detail of details) {
    const key = `${detail?.id || ''}:${detail?.label || ''}:${detail?.detail || ''}`;
    if (!key.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push(detail);
  }
  return out;
}

export function relaxGateForOpenWebOsint(gate = {}, packageId = '') {
  if (!OPTIONAL_OPEN_WEB_PACKAGES.has(String(packageId || '').trim())) return gate;

  const blockingDetails = Array.isArray(gate.launchBlockingDetails) ? gate.launchBlockingDetails : [];
  if (!blockingDetails.length) return gate;

  const onlyOptionalBlockers = blockingDetails.every((detail) => OPTIONAL_OPEN_WEB_BLOCKING_IDS.has(detail?.id));
  if (!onlyOptionalBlockers) return gate;

  const manualReviewDetails = dedupeManualReviewDetails([
    ...(Array.isArray(gate.manualReviewDetails) ? gate.manualReviewDetails : []),
    ...blockingDetails.map((detail) => ({
      id: `optional_${String(detail?.id || '').toLowerCase()}`,
      label: detail?.label || 'Optional licensed enrichment',
      detail: 'Licensed people-association enrichment is unavailable in this runtime. TraceWorks will continue with public-record and open-web OSINT coverage and treat this enrichment as an internal follow-up lane.'
    }))
  ]);

  return {
    ...gate,
    launchReady: true,
    launchRelaxed: true,
    launchMessage: `${gate.name || packageId} is launch-ready with public-record and open-web OSINT coverage. Licensed people-association enrichment is optional and falls back to internal review when unavailable.`,
    readinessSummary: `${gate.name || packageId} is launch-ready with public-record and open-web OSINT coverage. Licensed people-association enrichment is optional and falls back to internal review when unavailable.`,
    launchBlockingAreas: [],
    launchBlockingDetails: [],
    manualReviewLikely: true,
    manualReviewDetails
  };
}

function sanitizeCustomerFacingText(value) {
  let out = String(value ?? '');
  for (const rule of CUSTOMER_SAFE_REPLACEMENTS) {
    out = out.replace(rule.pattern, rule.replacement);
  }
  return out;
}

function sanitizeCustomerFacingValue(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeCustomerFacingValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeCustomerFacingValue(item)])
    );
  }
  if (typeof value === 'string') return sanitizeCustomerFacingText(value);
  return value;
}

export function sanitizeCustomerFacingReport(report = {}) {
  return sanitizeCustomerFacingValue(report);
}
