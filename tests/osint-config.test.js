import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveApifyOsintConfig,
  resolveFirecrawlConfig,
  resolvePremiumOsintConfig
} from '../netlify/functions/_lib/osint-config.js';

test('resolveFirecrawlConfig uses documented defaults', () => {
  const config = resolveFirecrawlConfig({ FIRECRAWL_API_KEY: 'firecrawl-secret' });
  assert.equal(config.configured, true);
  assert.equal(config.apiBaseUrl, 'https://api.firecrawl.dev/v2');
  assert.equal(config.scrapeResults, true);
  assert.equal(config.country, 'US');
});

test('resolveApifyOsintConfig defaults to the documented search actor and parses templates', () => {
  const config = resolveApifyOsintConfig({
    APIFY_API_TOKEN: 'apify-secret',
    APIFY_OSINT_INPUT_TEMPLATE: '{"queries":"{query}"}'
  });
  assert.equal(config.configured, true);
  assert.equal(config.actorId, 'apify~google-search-scraper');
  assert.deepEqual(config.inputTemplate, { queries: '{query}' });
  assert.equal(config.templateError, null);
});

test('resolvePremiumOsintConfig reports template errors without pretending provider readiness', () => {
  const config = resolvePremiumOsintConfig({
    APIFY_API_TOKEN: 'apify-secret',
    APIFY_OSINT_INPUT_TEMPLATE: '{"queries":'
  });
  assert.ok(config.configuredProviders.includes('apify'));
  assert.ok(config.apify.templateError?.includes('must be valid JSON'));
});
