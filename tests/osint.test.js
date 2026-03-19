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
  const result = await gatherOsint('jordan mercer texas', { packageId: 'ownership_encumbrance', fetchImpl: mockFetch });

  assert.ok(result.queryPlan.length >= 2);
  assert.ok(result.coverage.totalSources >= 2);
  assert.equal(result.packageId, 'ownership_encumbrance');
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
    packageId: 'standard',
    fetchImpl: robinFetch,
    env: { ROBIN_API_URL: 'https://robin.example' }
  });

  assert.ok(result.sources.some((s) => s.provider === 'robin'));
  assert.ok(result.providerHealth.some((p) => p.provider === 'robin'));
});

test('gatherOsint keeps zero-hit runs empty instead of injecting fallback sources', async () => {
  const result = await gatherOsint('no results expected', {
    packageId: 'standard',
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) })
  });

  assert.equal(result.sources.length, 0);
  assert.equal(result.coverage.totalSources, 0);
  assert.ok(result.providerNote.includes('No open-web OSINT providers returned sourceable hits'));
});

test('gatherOsint normalizes legacy package aliases and counts structured evidence separately', async () => {
  const result = await gatherOsint('jordan mercer texas', {
    packageId: 'title',
    fetchImpl: async (url) => {
      if (url.includes('duckduckgo.com')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            RelatedTopics: [{ FirstURL: 'https://records.example/subject', Text: 'Subject record' }]
          })
        });
      }
      if (url.includes('wikipedia.org')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ query: { search: [] } })
        });
      }
      if (url.includes('reddit.com')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { children: [] } })
        });
      }
      if (url.includes('opencorporates.com')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ results: { companies: [] } })
        });
      }
      if (url.includes('example.com/property-search')) {
        return {
          ok: true,
          text: async () => '<table><tr><td>Jordan Mercer</td></tr></table>'
        };
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    },
    publicRecordOrder: {
      packageKey: 'standard',
      input: { ownerName: 'Jordan Mercer' }
    },
    env: {
      PAID_FULFILLMENT_STRICT: 'true',
      PUBLIC_RECORD_SOURCE_CONFIG: JSON.stringify({
        countyProperty: [
          {
            id: 'county_property_demo_html',
            name: 'County Property Demo',
            type: 'html',
            request: { urlTemplate: 'https://example.com/property-search?name={owner}' },
            extraction: {
              itemRegex: '<tr><td>([^<]*)</td></tr>',
              map: { owner: 1 }
            }
          }
        ],
        countyRecorder: [],
        probateIndex: [],
        entitySearch: []
      })
    }
  });

  assert.equal(result.packageId, 'ownership_encumbrance');
  assert.equal(result.coverage.totalStructuredEvidence, 1);
  assert.equal(result.coverage.totalSources, result.coverage.totalOpenWebSources + result.coverage.totalStructuredEvidence);
});

test('gatherOsint adds Firecrawl provider hits when configured', async () => {
  const result = await gatherOsint('jordan mercer texas', {
    packageId: 'asset_network',
    env: { FIRECRAWL_API_KEY: 'firecrawl-secret' },
    fetchImpl: async (url) => {
      if (url.includes('duckduckgo.com')) return { ok: true, json: async () => ({ RelatedTopics: [] }) };
      if (url.includes('wikipedia.org')) return { ok: true, json: async () => ({ query: { search: [] } }) };
      if (url.includes('reddit.com')) return { ok: true, json: async () => ({ data: { children: [] } }) };
      if (url.includes('opencorporates.com')) return { ok: true, json: async () => ({ results: { companies: [] } }) };
      if (url.includes('firecrawl.dev')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              web: [
                {
                  title: 'County record lead',
                  url: 'https://county.example/record',
                  markdown: '# County record lead'
                }
              ]
            }
          })
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }
  });

  assert.ok(result.sources.some((source) => source.provider === 'firecrawl'));
  assert.ok(result.providerHealth.some((provider) => provider.provider === 'firecrawl' && provider.hitCount >= 1));
});

test('gatherOsint adds Apify actor hits when configured', async () => {
  const result = await gatherOsint('jordan mercer texas', {
    packageId: 'standard',
    env: { APIFY_API_TOKEN: 'apify-secret' },
    fetchImpl: async (url) => {
      if (url.includes('duckduckgo.com')) return { ok: true, json: async () => ({ RelatedTopics: [] }) };
      if (url.includes('wikipedia.org')) return { ok: true, json: async () => ({ query: { search: [] } }) };
      if (url.includes('reddit.com')) return { ok: true, json: async () => ({ data: { children: [] } }) };
      if (url.includes('opencorporates.com')) return { ok: true, json: async () => ({ results: { companies: [] } }) };
      if (url.includes('api.apify.com')) {
        return {
          ok: true,
          json: async () => ([
            {
              nonPromotedSearchResults: [
                {
                  title: 'Apify actor lead',
                  url: 'https://lead.example/osint',
                  description: 'Web lead from search actor'
                }
              ]
            }
          ])
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }
  });

  assert.ok(result.sources.some((source) => source.provider === 'apify'));
  assert.ok(result.providerHealth.some((provider) => provider.provider === 'apify' && provider.hitCount >= 1));
});

test('gatherOsint ranks higher-trust provider evidence ahead of weaker open-web ties', async () => {
  const result = await gatherOsint('jordan mercer texas', {
    packageId: 'standard',
    env: {
      FIRECRAWL_API_KEY: 'firecrawl-secret',
      APIFY_API_TOKEN: 'apify-secret'
    },
    fetchImpl: async (url) => {
      if (url.includes('duckduckgo.com')) {
        return {
          ok: true,
          json: async () => ({
            RelatedTopics: [{ FirstURL: 'https://generic.example/open-web', Text: 'Generic web result' }]
          })
        };
      }
      if (url.includes('wikipedia.org')) {
        return { ok: true, json: async () => ({ query: { search: [{ title: 'Jordan Mercer' }] } }) };
      }
      if (url.includes('reddit.com')) {
        return {
          ok: true,
          json: async () => ({ data: { children: [{ data: { title: 'Community thread', permalink: '/r/example' } }] } })
        };
      }
      if (url.includes('opencorporates.com')) {
        return { ok: true, json: async () => ({ results: { companies: [] } }) };
      }
      if (url.includes('firecrawl.dev')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              web: [
                {
                  title: 'County dossier lead',
                  url: 'https://premium.example/dossier',
                  markdown: '# Dossier'
                }
              ]
            }
          })
        };
      }
      if (url.includes('api.apify.com')) {
        return {
          ok: true,
          json: async () => ([
            {
              nonPromotedSearchResults: [
                {
                  title: 'Structured search lead',
                  url: 'https://search.example/lead',
                  description: 'Structured search result'
                }
              ]
            }
          ])
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }
  });

  assert.equal(result.sources[0].provider, 'firecrawl');
  assert.equal(result.sources[1].provider, 'apify');
  assert.equal(result.sources.at(-1).provider, 'reddit');
});
