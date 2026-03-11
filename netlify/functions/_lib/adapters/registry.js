import { SourceAdapterError } from './base-adapter.js';
import { runHtmlAdapter } from './html-adapter.js';
import { runJsonAdapter } from './json-adapter.js';

export async function runConfiguredSource(config, query, opts = {}) {
  if (!config || !config.type) {
    throw new SourceAdapterError('Source config missing type');
  }

  if (config.type === 'html') return runHtmlAdapter(config, query, opts);
  if (config.type === 'json') return runJsonAdapter(config, query, opts);

  throw new SourceAdapterError(`Unsupported source config type: ${config.type}`);
}
