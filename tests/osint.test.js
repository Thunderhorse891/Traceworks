import test from 'node:test';
import assert from 'node:assert/strict';
import { gatherOsint } from '../netlify/functions/_lib/osint.js';

function mockFetch(url) {
  if (url.includes('duckduckgo.com')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        RelatedTopics: [
          { FirstURL: 'https://records.example/subject', Text: 'Subject record' },
          { FirstURL: 'https://records.example/subject', Text: 'Duplicate subject record' }
        ]
      })
    });
  }

  if (url.includes('wikipedia.org')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ query: { search: [{ title: 'Jordan Mercer' }] } })
    });
  }

  if (url.includes('reddit.com')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ data: { children: [{ data: { title: 'Thread', permalink: '/r/x' } }] } })
    });
  }

  return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
}

test('gatherOsint builds expanded query plan and dedupes sources', async () => {
  const result = await gatherOsint('jordan mercer texas', { packageId: 'title', fetchImpl: mockFetch });

  assert.ok(result.queryPlan.length >= 2);
  assert.ok(result.coverage.totalSources >= 2);
  assert.ok(result.coverage.distinctDomains >= 1);
  assert.ok(result.sources.length <= 18);
});

test('gatherOsint uses robin provider when configured', async () => {
  function robinFetch(url) {
    if (url.includes('/search?q=')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          results: [{ title: 'Robin court index result', url: 'https://robin.example/case/1', sourceType: 'court-records', confidence: 'high' }]
        })
      });
    }
    return mockFetch(url);
  }

  const result = await gatherOsint('jordan mercer texas', {
    packageId: 'locate',
    fetchImpl: robinFetch,
    env: { ROBIN_API_URL: 'https://robin.example' }
  });

  assert.ok(result.sources.some((s) => s.provider === 'robin'));
  assert.ok(result.providerHealth.some((p) => p.provider === 'robin'));
});

test('gatherOsint keeps zero-hit runs empty instead of injecting fallback sources', async () => {
  const result = await gatherOsint('no results expected', {
    packageId: 'locate',
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) })
  });

  assert.equal(result.sources.length, 0);
  assert.equal(result.coverage.totalSources, 0);
  assert.ok(result.providerNote.includes('No open-web OSINT providers returned sourceable hits'));
});
