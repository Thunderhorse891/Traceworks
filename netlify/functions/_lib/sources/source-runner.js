import { SourceAdapterError, buildEvidenceEntry } from '../adapters/base-adapter.js';
import { runConfiguredSource } from '../adapters/registry.js';

function classifyError(err) {
  const status = Number(err?.details?.status || 0);
  const message = String(err?.message || '').toLowerCase();
  if (status === 401 || status === 403 || message.includes('captcha') || message.includes('forbidden') || message.includes('cloudflare')) {
    return 'blocked';
  }
  if (status >= 500 || message.includes('timeout') || message.includes('network')) {
    return 'error';
  }
  return 'error';
}

export async function runSourceGroup(configs = [], makeQuery, { fetchImpl = fetch } = {}) {
  const allResults = [];
  const evidence = [];

  for (const config of configs) {
    const query = makeQuery(config);
    try {
      const out = await runConfiguredSource(config, query, { fetchImpl });
      allResults.push(...out.results);
      evidence.push(out.evidence);
    } catch (err) {
      const wrapped = err instanceof SourceAdapterError ? err : new SourceAdapterError(String(err?.message || err), {});
      evidence.push(
        buildEvidenceEntry({
          sourceId: config?.id || 'unknown_source',
          sourceName: config?.name || 'Unknown Source',
          query,
          url: config?.request?.urlTemplate || 'n/a',
          status: classifyError(wrapped),
          notes: wrapped.message,
          rawCount: 0,
          extractedCount: 0
        })
      );
    }
  }

  return { results: allResults, evidence };
}
