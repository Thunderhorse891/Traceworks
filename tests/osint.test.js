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
  assert.ok(result.sources.length <= 16);
});
