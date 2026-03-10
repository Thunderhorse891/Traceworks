const REQUIRED_PUBLIC_RECORD_PACKAGES = new Set(['title', 'heir', 'comprehensive']);

function nowIso() {
  return new Date().toISOString();
}

function safeParseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

function buildEvidence({
  sourceId,
  sourceName,
  query,
  url,
  status,
  notes = '',
  rawCount = 0,
  extractedCount = 0,
}) {
  return {
    sourceId,
    sourceName,
    query,
    url,
    status,
    notes,
    rawCount,
    extractedCount,
    timestamp: nowIso(),
  };
}

function expandTemplate(template, values) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => {
    const value = values[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function matchAll(text, regex) {
  const out = [];
  let match;
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const r = new RegExp(regex.source, flags);

  while ((match = r.exec(text)) !== null) {
    out.push(match);
  }

  return out;
}

function pick(obj, path) {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function getSourceConfig() {
  const raw = process.env.TRACEWORKS_PUBLIC_RECORDS_CONFIG_JSON;

  if (!raw || !raw.trim()) {
    return {
      countyProperty: [],
      countyRecorder: [],
      probateIndex: [],
      entitySearch: [],
    };
  }

  const parsed = safeParseJson(raw, null);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('TRACEWORKS_PUBLIC_RECORDS_CONFIG_JSON is not valid JSON');
  }

  return {
    countyProperty: Array.isArray(parsed.countyProperty) ? parsed.countyProperty : [],
    countyRecorder: Array.isArray(parsed.countyRecorder) ? parsed.countyRecorder : [],
    probateIndex: Array.isArray(parsed.probateIndex) ? parsed.probateIndex : [],
    entitySearch: Array.isArray(parsed.entitySearch) ? parsed.entitySearch : [],
  };
}

async function runHtmlSource(config, query) {
  const url = expandTemplate(config.request?.urlTemplate, query);
  const method = config.request?.method || 'GET';
  const headers = config.request?.headers || {};
  const body = config.request?.bodyTemplate
    ? expandTemplate(config.request.bodyTemplate, query)
    : undefined;

  const response = await fetch(url, { method, headers, body });
  const html = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${config.name} (${url})`);
  }

  const itemRegex = new RegExp(config.extraction?.itemRegex || '', 'gis');
  const matches = matchAll(html, itemRegex);

  const results = matches
    .map((match) => {
      const row = {};
      for (const [field, index] of Object.entries(config.extraction?.map || {})) {
        row[field] = (match[index] || '').replace(/\s+/g, ' ').trim();
      }
      return row;
    })
    .filter((row) => Object.values(row).some(Boolean));

  return {
    results,
    evidence: buildEvidence({
      sourceId: config.id,
      sourceName: config.name,
      query,
      url,
      status: results.length ? 'found' : 'not_found',
      rawCount: matches.length,
      extractedCount: results.length,
    }),
  };
}

async function runJsonSource(config, query) {
  const url = expandTemplate(config.request?.urlTemplate, query);
  const method = config.request?.method || 'GET';
  const headers = config.request?.headers || {};

  const response = await fetch(url, { method, headers });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${config.name} (${url})`);
  }

  const json = safeParseJson(text, null);
  if (!json) {
    throw new Error(`Invalid JSON returned by ${config.name} (${url})`);
  }

  const items = pick(json, config.extraction?.itemsPath) || [];
  const results = Array.isArray(items)
    ? items.map((item) => {
        const row = {};
        for (const [field, path] of Object.entries(config.extraction?.map || {})) {
          row[field] = pick(item, path);
        }
        return row;
      })
    : [];

  return {
    results,
    evidence: buildEvidence({
      sourceId: config.id,
      sourceName: config.name,
      query,
      url,
      status: results.length ? 'found' : 'not_found',
      rawCount: Array.isArray(items) ? items.length : 0,
      extractedCount: results.length,
    }),
  };
}

async function runConfiguredSource(config, query) {
  if (!config?.type) {
    throw new Error('Source config missing type');
  }

  if (config.type === 'html') {
    return runHtmlSource(config, query);
  }

  if (config.type === 'json') {
    return runJsonSource(config, query);
  }

  throw new Error(`Unsupported source type: ${config.type}`);
}

function normalizeInput(payload = {}) {
  return {
    address: payload.address || payload.propertyAddress || '',
    ownerName: payload.ownerName || payload.fullName || payload.companyName || '',
    parcel: payload.parcel || payload.apn || '',
    county: payload.county || '',
    state: payload.state || '',
    decedentName: payload.decedentName || payload.ownerName || payload.fullName || '',
    entityName: payload.entityName || payload.companyName || '',
  };
}

export function publicRecordEvidenceToSources(evidence = []) {
  return evidence.map((entry) => ({
    title: entry.sourceName || entry.sourceId || 'Public record source',
    url: entry.url || '',
    sourceType: 'public_record',
    confidence: entry.status === 'found' ? 'medium' : 'guarded',
    domain: getDomain(entry.url || ''),
    provider: 'public-records',
  }));
}

export async function gatherPublicRecordIntel(payload = {}) {
  const packageId = String(payload.packageId || '').toLowerCase();
  const input = normalizeInput(payload);
  const config = getSourceConfig();

  const hasAnyConfiguredSources =
    config.countyProperty.length ||
    config.countyRecorder.length ||
    config.probateIndex.length ||
    config.entitySearch.length;

  if (REQUIRED_PUBLIC_RECORD_PACKAGES.has(packageId) && !hasAnyConfiguredSources) {
    throw new Error(
      `Public record source config is missing for package "${packageId}". ` +
      `Set TRACEWORKS_PUBLIC_RECORDS_CONFIG_JSON before selling this report tier.`
    );
  }

  const findings = {};
  const evidence = [];
  const gaps = [];

  if (packageId === 'title' || packageId === 'comprehensive') {
    for (const source of config.countyProperty) {
      const out = await runConfiguredSource(source, {
        address: input.address,
        owner: input.ownerName,
        parcel: input.parcel,
        county: input.county,
        state: input.state,
      });
      findings.countyProperty = [...(findings.countyProperty || []), ...out.results];
      evidence.push(out.evidence);
    }

    for (const source of config.countyRecorder) {
      const out = await runConfiguredSource(source, {
        address: input.address,
        owner: input.ownerName,
        parcel: input.parcel,
        county: input.county,
        state: input.state,
      });
      findings.countyRecorder = [...(findings.countyRecorder || []), ...out.results];
      evidence.push(out.evidence);
    }

    if (!findings.countyProperty?.length) gaps.push('No county property results found');
    if (!findings.countyRecorder?.length) gaps.push('No county recorder results found');
  }

  if (packageId === 'heir' || packageId === 'comprehensive') {
    for (const source of config.probateIndex) {
      const out = await runConfiguredSource(source, {
        decedent: input.decedentName,
        county: input.county,
        state: input.state,
      });
      findings.probateIndex = [...(findings.probateIndex || []), ...out.results];
      evidence.push(out.evidence);
    }

    if (!findings.probateIndex?.length) gaps.push('No probate index results found');
  }

  if (input.entityName) {
    for (const source of config.entitySearch) {
      const out = await runConfiguredSource(source, {
        entityName: input.entityName,
        county: input.county,
        state: input.state,
      });
      findings.entitySearch = [...(findings.entitySearch || []), ...out.results];
      evidence.push(out.evidence);
    }

    if (!findings.entitySearch?.length && config.entitySearch.length) {
      gaps.push('No entity registry results found');
    }
  }

  return {
    packageId,
    input,
    findings,
    evidence,
    gaps,
    sources: publicRecordEvidenceToSources(evidence),
    coverage: {
      totalEvidence: evidence.length,
      totalFindings: Object.values(findings).reduce(
        (sum, value) => sum + (Array.isArray(value) ? value.length : 0),
        0
      ),
    },
  };
}
