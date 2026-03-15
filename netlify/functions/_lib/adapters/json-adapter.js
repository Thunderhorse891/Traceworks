import { SourceAdapterError, buildEvidenceEntry, fetchTextWithPolicy, requireValue } from './base-adapter.js';

function expandTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = values[key];
    return v === undefined || v === null ? '' : encodeURIComponent(String(v));
  });
}

function pick(obj, path) {
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export async function runJsonAdapter(config, query, { fetchImpl = fetch } = {}) {
  requireValue('config.id', config.id);
  requireValue('config.name', config.name);
  requireValue('config.request.urlTemplate', config.request?.urlTemplate);
  requireValue('config.extraction.itemsPath', config.extraction?.itemsPath);

  const url = expandTemplate(config.request.urlTemplate, query);
  const startedAt = Date.now();
  const { res, text, attempts } = await fetchTextWithPolicy({
    url,
    method: config.request.method || 'GET',
    headers: config.request.headers || {},
    fetchImpl
  });
  if (!res.ok) {
    throw new SourceAdapterError(`HTTP ${res.status} while fetching ${url}`, {
      status: res.status,
      url,
      bodyPreview: text.slice(0, 500),
      attempts,
      classification: [401, 403, 429].includes(res.status) ? 'blocked' : res.status >= 500 ? 'unavailable' : 'error'
    });
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new SourceAdapterError(`Invalid JSON from ${url}`, { url, parseError: err.message });
  }

  const items = pick(json, config.extraction.itemsPath) || [];
  const rows = Array.isArray(items) ? items : [];

  const results = rows.map((item) => {
    const row = {};
    for (const [field, fieldPath] of Object.entries(config.extraction.map || {})) {
      row[field] = pick(item, fieldPath);
    }
    return row;
  });

  return {
    results,
    evidence: buildEvidenceEntry({
      sourceId: config.id,
      sourceName: config.name,
      query,
      url,
      status: results.length ? 'found' : 'not_found',
      rawCount: rows.length,
      extractedCount: results.length,
      attempts,
      durationMs: Date.now() - startedAt
    })
  };
}
