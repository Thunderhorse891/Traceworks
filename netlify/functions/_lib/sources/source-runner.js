import { SourceAdapterError, buildEvidenceEntry } from '../adapters/base-adapter.js';
import { runConfiguredSource } from '../adapters/registry.js';

function classifyError(err) {
  if (err?.details?.classification) return err.details.classification;

  const status = Number(err?.details?.status || 0);
  const message = String(err?.message || '').toLowerCase();
  if (status === 401 || status === 403 || status === 429 || message.includes('captcha') || message.includes('forbidden') || message.includes('cloudflare')) {
    return 'blocked';
  }
  if (message.includes('timeout') || message.includes('timed out')) return 'unavailable';
  if (status >= 500 || message.includes('network')) return 'error';
  return 'error';
}

function templateKeys(text = '') {
  return [...String(text).matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
  return String(value ?? '').trim().length > 0;
}

function shouldSkipConfig(config, query) {
  const request = config?.request || {};
  const referenced = new Set([
    ...templateKeys(request.urlTemplate || ''),
    ...templateKeys(request.bodyTemplate || '')
  ]);

  if (referenced.size === 0) return false;
  return ![...referenced].some((key) => hasMeaningfulValue(query?.[key]));
}

export async function runSourceGroup(configs = [], makeQuery, { fetchImpl = fetch } = {}) {
  const allResults = [];
  const evidence = [];

  for (const config of configs) {
    const query = makeQuery(config);

    if (shouldSkipConfig(config, query)) {
      evidence.push(
        buildEvidenceEntry({
          sourceId: config?.id || 'unknown_source',
          sourceName: config?.name || 'Unknown Source',
          query,
          url: config?.request?.urlTemplate || 'n/a',
          status: 'skipped',
          notes: 'Skipped because the order did not include any identifier required by this source template.',
          rawCount: 0,
          extractedCount: 0
        })
      );
      continue;
    }

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
          extractedCount: 0,
          attempts: wrapped.details?.attempts ?? 1
        })
      );
    }
  }

  return { results: allResults, evidence };
}
