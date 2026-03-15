import test from 'node:test';
import assert from 'node:assert/strict';

function withAdminKey() {
  const prior = process.env.ADMIN_API_KEY;
  process.env.ADMIN_API_KEY = 'admin-secret';
  return () => {
    if (prior === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = prior;
  };
}

function makeAdminEvent(body, overrides = {}) {
  return {
    httpMethod: 'POST',
    headers: {
      authorization: 'Bearer admin-secret',
      ...overrides.headers
    },
    body: JSON.stringify(body),
    ...overrides
  };
}

test('runSourceProof returns launch-blocked details when coverage is not ready', async () => {
  const { runSourceProof } = await import(`../netlify/functions/_lib/source-proof.js?ts=${Date.now()}`);

  const result = await runSourceProof({
    packageId: 'standard',
    subjectName: 'Jane Owner',
    county: 'Dallas',
    state: 'TX'
  }, {
    deps: {
      assessOrderLaunchGateImpl: () => ({
        launchReady: false,
        launchMessage: 'Coverage is not ready for Dallas County, TX.',
        launchBlockingAreas: ['jurisdiction'],
        launchBlockingDetails: [{ id: 'countyProperty_coverage', label: 'County property coverage', detail: 'No in-scope sources.' }],
        orderCoverage: { locationLabel: 'Dallas County, TX' }
      })
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.launchBlocked, true);
  assert.equal(result.blockingAreas[0], 'jurisdiction');
});

test('runSourceProof summarizes live provider and public-record output', async () => {
  const { runSourceProof } = await import(`../netlify/functions/_lib/source-proof.js?ts=${Date.now()}`);

  const result = await runSourceProof({
    packageId: 'ownership_encumbrance',
    subjectName: 'Jane Owner',
    county: 'Harris',
    state: 'TX',
    lastKnownAddress: '123 Main St'
  }, {
    deps: {
      assessOrderLaunchGateImpl: () => ({
        launchReady: true,
        manualReviewLikely: false,
        manualReviewDetails: [],
        orderCoverage: { locationLabel: 'Harris County, TX' }
      }),
      gatherOsintImpl: async () => ({
        coverage: {
          totalSources: 5,
          totalOpenWebSources: 2,
          totalStructuredEvidence: 3,
          distinctDomains: 2,
          providersWithHits: 2
        },
        providerHealth: [
          { provider: 'duckduckgo', hitCount: 1, ok: true },
          { provider: 'firecrawl', hitCount: 1, ok: true }
        ],
        providerNote: 'Open-web and structured sources both returned cited results.',
        sources: [
          { domain: 'example.com', provider: 'duckduckgo' },
          { domain: 'records.example', provider: 'firecrawl' }
        ],
        publicRecords: {
          requestedFamilies: ['countyProperty', 'countyRecorder'],
          executedFamilies: ['countyProperty', 'countyRecorder'],
          sourceHealth: { attempted: 3, found: 2, blocked: 0, skipped: 0, error: 0 },
          gaps: []
        }
      })
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.totalStructuredEvidence, 3);
  assert.equal(result.summary.providersWithHits, 2);
  assert.equal(result.topSources.length, 2);
  assert.equal(result.orderCoverage.locationLabel, 'Harris County, TX');
});

test('handleSourceProof records and returns proof results', async () => {
  const restore = withAdminKey();
  const saved = [];
  const { handleSourceProof } = await import(`../netlify/functions/source-proof.js?ts=${Date.now()}`);

  try {
    const response = await handleSourceProof(makeAdminEvent({
      packageId: 'standard',
      subjectName: 'Jane Owner',
      county: 'Harris',
      state: 'TX'
    }), {
      runSourceProofImpl: async () => ({
        ok: true,
        packageId: 'standard',
        packageName: 'Standard Property Snapshot',
        input: { subjectName: 'Jane Owner', county: 'Harris', state: 'TX' },
        summary: { totalStructuredEvidence: 2, totalOpenWebSources: 1, providersWithHits: 1, publicRecordGaps: [] },
        providerHealth: [{ provider: 'duckduckgo', hitCount: 1 }],
        providerNote: 'Good run.',
        topSources: [{ domain: 'example.com' }],
        orderCoverage: { locationLabel: 'Harris County, TX' }
      }),
      recordLaunchProofImpl: async (entry) => {
        saved.push(entry);
      }
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.ok, true);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].packageId, 'standard');
  } finally {
    restore();
  }
});

test('handleSourceProof lists recent recorded proofs', async () => {
  const restore = withAdminKey();
  const { handleSourceProof } = await import(`../netlify/functions/source-proof.js?ts=${Date.now()}`);

  try {
    const response = await handleSourceProof({
      httpMethod: 'GET',
      headers: { authorization: 'Bearer admin-secret' },
      queryStringParameters: { limit: '2' }
    }, {
      listLaunchProofsImpl: async () => ([
        { packageId: 'standard', subjectName: 'Jane Owner', ok: true },
        { packageId: 'comprehensive', subjectName: 'Estate of Doe', ok: false }
      ])
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.proofs.length, 2);
    assert.equal(body.proofs[0].packageId, 'standard');
  } finally {
    restore();
  }
});
