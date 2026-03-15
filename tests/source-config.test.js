import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findStrictSourceConfigGaps,
  loadSourceConfig,
  summarizeSourceConfig
} from '../netlify/functions/_lib/sources/source-config.js';

test('summarizeSourceConfig counts total and browser-backed sources', () => {
  const summary = summarizeSourceConfig({
    countyProperty: [{ id: 'property_html', type: 'html' }],
    countyRecorder: [{ id: 'recorder_browser', type: 'browser' }, { id: 'recorder_json', type: 'json' }],
    probateIndex: [],
    entitySearch: [{ id: 'entity_browser', type: 'browser' }]
  });

  assert.equal(summary.totalSources, 4);
  assert.equal(summary.browserBackedSources, 2);
  assert.deepEqual(summary.families, {
    countyProperty: 1,
    countyRecorder: 2,
    probateIndex: 0,
    entitySearch: 1
  });
});

test('findStrictSourceConfigGaps flags empty source families', () => {
  const gaps = findStrictSourceConfigGaps({
    countyProperty: [{ id: 'property_html', type: 'html' }],
    countyRecorder: [],
    probateIndex: [],
    entitySearch: [{ id: 'entity_html', type: 'html' }]
  });

  assert.deepEqual(gaps, ['countyRecorder', 'probateIndex']);
});

test('loadSourceConfig rejects invalid JSON', () => {
  assert.throws(
    () => loadSourceConfig({ PUBLIC_RECORD_SOURCE_CONFIG: '{"countyProperty":[' }),
    /PUBLIC_RECORD_SOURCE_CONFIG must be valid JSON/
  );
});
