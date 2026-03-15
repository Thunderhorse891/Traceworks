import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assessPackageJurisdictionCoverage,
  findStrictSourceConfigGaps,
  loadSourceConfig,
  summarizeSourceConfig,
  usingBundledSourceConfig
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

test('usingBundledSourceConfig detects when the starter catalog is still active', () => {
  assert.equal(usingBundledSourceConfig({}), true);
  assert.equal(usingBundledSourceConfig({ PUBLIC_RECORD_SOURCE_CONFIG: '{"countyProperty":[],"countyRecorder":[],"probateIndex":[],"entitySearch":[]}' }), false);
});

test('assessPackageJurisdictionCoverage flags unsupported county coverage', () => {
  const coverage = assessPackageJurisdictionCoverage({
    packageId: 'standard',
    input: { county: 'Dallas', state: 'TX', subjectType: 'property', subjectName: 'Jane Owner' },
    env: {
      PUBLIC_RECORD_SOURCE_CONFIG: JSON.stringify({
        countyProperty: [{ id: 'harris-only', type: 'html', coverage: { states: ['TX'], counties: ['Harris'] } }],
        countyRecorder: [],
        probateIndex: [],
        entitySearch: []
      })
    }
  });

  assert.equal(coverage.coverageReady, false);
  assert.equal(coverage.blockingFamilies.length, 1);
  assert.ok(coverage.blockingFamilies[0].detail.includes('Dallas County, TX'));
});

test('assessPackageJurisdictionCoverage marks browser-only families for manual review', () => {
  const coverage = assessPackageJurisdictionCoverage({
    packageId: 'ownership_encumbrance',
    input: { county: 'Harris', state: 'TX', subjectType: 'property', subjectName: 'Jane Owner' },
    env: {
      PUBLIC_RECORD_SOURCE_CONFIG: JSON.stringify({
        countyProperty: [{ id: 'property', type: 'html', coverage: { states: ['TX'], counties: ['Harris'] } }],
        countyRecorder: [{ id: 'recorder-browser', type: 'browser', coverage: { states: ['TX'], counties: ['Harris'] } }],
        probateIndex: [],
        entitySearch: []
      })
    }
  });

  assert.equal(coverage.coverageReady, true);
  assert.equal(coverage.manualReviewFamilies.length, 1);
  assert.equal(coverage.manualReviewFamilies[0].family, 'countyRecorder');
});

test('assessPackageJurisdictionCoverage does not require entity coverage unless intake is entity-scoped', () => {
  const coverage = assessPackageJurisdictionCoverage({
    packageId: 'asset_network',
    input: { county: 'Harris', state: 'TX', subjectType: 'person', subjectName: 'Jane Owner' },
    env: {
      PUBLIC_RECORD_SOURCE_CONFIG: JSON.stringify({
        countyProperty: [{ id: 'property', type: 'html' }],
        countyRecorder: [{ id: 'recorder', type: 'html' }],
        probateIndex: [],
        entitySearch: []
      })
    }
  });

  assert.equal(coverage.coverageReady, true);
  assert.equal(coverage.blockingFamilies.length, 0);
});
