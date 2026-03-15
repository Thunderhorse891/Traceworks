import { SourceAdapterError, buildEvidenceEntry, fetchTextWithPolicy, requireValue } from './base-adapter.js';

function matchAll(text, regex) {
  const out = [];
  let m;
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const r = new RegExp(regex.source, flags);
  while ((m = r.exec(text)) !== null) out.push(m);
  return out;
}

function expandTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = values[key];
    return v === undefined || v === null ? '' : encodeURIComponent(String(v));
  });
}

export async function runHtmlAdapter(config, query, { fetchImpl = fetch } = {}) {
  requireValue('config.id', config.id);
  requireValue('config.name', config.name);
  requireValue('config.request.urlTemplate', config.request?.urlTemplate);
  requireValue('config.extraction.itemRegex', config.extraction?.itemRegex);

  const url = expandTemplate(config.request.urlTemplate, query);
  const method = config.request.method || 'GET';
  const headers = config.request.headers || {};
  const body = config.request.bodyTemplate ? expandTemplate(config.request.bodyTemplate, query) : undefined;
  const startedAt = Date.now();

  const { res, text, attempts } = await fetchTextWithPolicy({ url, method, headers, body, fetchImpl });
  if (!res.ok) {
    throw new SourceAdapterError(`HTTP ${res.status} while fetching ${url}`, {
      status: res.status,
      url,
      bodyPreview: text.slice(0, 500),
      attempts,
      classification: [401, 403, 429].includes(res.status) ? 'blocked' : res.status >= 500 ? 'unavailable' : 'error'
    });
  }
  const html = text;

  const itemRegex = new RegExp(config.extraction.itemRegex, 'gis');
  const matches = matchAll(html, itemRegex);

  const results = matches
    .map((m) => {
      const row = {};
      for (const [field, idx] of Object.entries(config.extraction.map || {})) {
        row[field] = (m[idx] || '').replace(/\s+/g, ' ').trim();
      }
      return row;
    })
    .filter((row) => Object.values(row).some(Boolean));

  return {
    results,
    evidence: buildEvidenceEntry({
      sourceId: config.id,
      sourceName: config.name,
      query,
      url,
      status: results.length ? 'found' : 'not_found',
      rawCount: matches.length,
      extractedCount: results.length,
      attempts,
      durationMs: Date.now() - startedAt
    })
  };
}
