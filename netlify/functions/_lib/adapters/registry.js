import { SourceAdapterError } from './base-adapter.js';
import { runHtmlAdapter } from './html-adapter.js';
import { runJsonAdapter } from './json-adapter.js';

export async function runConfiguredSource(config, query, opts = {}) {
  if (!config || !config.type) {
    throw new SourceAdapterError('Source config missing type');
  }

  if (config.type === 'html') return runHtmlAdapter(config, query, opts);
  if (config.type === 'json') return runJsonAdapter(config, query, opts);
  if (config.type === 'browser') {
    throw new SourceAdapterError(`Browser-backed source is not available in this runtime: ${config.id || 'unknown_source'}`, {
      classification: 'unavailable',
      sourceId: config.id || 'unknown_source'
    });
  }

  throw new SourceAdapterError(`Unsupported source config type: ${config.type}`);
}
