import test from 'node:test';
import assert from 'node:assert/strict';

import { getPackage, PACKAGE_LIST } from '../netlify/functions/_lib/packages.js';
import { OSINT_REPO_MAP } from '../netlify/functions/_lib/osintRepoMap.js';
import { gatherOsint } from '../netlify/functions/_lib/osint.js';

function mockJsonResponse(payload) {
  return {
    ok: true,
    async json() {
      return payload;
    }
  };
}

async function mockFetch(url) {
  const value = String(url);
  if (value.includes('duckduckgo.com')) return mockJsonResponse({ RelatedTopics: [] });
  if (value.includes('wikipedia.org')) return mockJsonResponse({ query: { search: [] } });
  if (value.includes('reddit.com')) return mockJsonResponse({ data: { children: [] } });
  if (value.includes('opencorporates.com')) return mockJsonResponse({ results: { companies: [] } });
  if (value.includes('api.github.com/search/repositories')) {
    return mockJsonResponse({
      items: [
        {
          full_name: 'example/probate-scraper',
          html_url: 'https://github.com/example/probate-scraper',
          stargazers_count: 7
        }
      ]
    });
  }
  throw new Error(`Unexpected fetch URL in test: ${value}`);
}

test('every package OSINT category resolves to a configured repo map entry', () => {
  for (const pkg of PACKAGE_LIST) {
    assert.ok(Array.isArray(pkg.osintCategories), `${pkg.id} is missing osintCategories`);
    if (pkg.openWebEnabled !== false) {
      assert.ok(pkg.osintCategories.length > 0, `${pkg.id} should define at least one OSINT category`);
    }
    for (const categoryId of pkg.osintCategories) {
      assert.ok(OSINT_REPO_MAP[categoryId], `Missing OSINT repo map entry for ${categoryId}`);
      assert.ok(Array.isArray(OSINT_REPO_MAP[categoryId].repos), `OSINT repo map entry for ${categoryId} is missing repos`);
      assert.ok(OSINT_REPO_MAP[categoryId].repos.length > 0, `OSINT repo map entry for ${categoryId} should list at least one repo`);
    }
  }
});

test('gatherOsint returns repo-backed category plans for purchased package categories', async () => {
  const pkg = getPackage('probate_heirship');
  const result = await gatherOsint('Jane Doe Travis County TX', {
    packageId: 'probate_heirship',
    fetchImpl: mockFetch,
    env: {},
    investigationInput: {
      subjectName: 'Jane Doe',
      county: 'Travis',
      state: 'TX',
      deathYear: '2023'
    }
  });

  assert.deepEqual(result.osintCategories, pkg.osintCategories);
  assert.equal(result.repoCategoryResults.length, pkg.osintCategories.length);
  assert.ok(result.repoReferences.length >= pkg.osintCategories.length);
  for (const categoryResult of result.repoCategoryResults) {
    assert.ok(categoryResult.queryPlan.length > 0, `Expected query plan for ${categoryResult.categoryId}`);
    assert.ok(categoryResult.repoReferences.length > 0, `Expected repo references for ${categoryResult.categoryId}`);
  }
});

test('gatherOsint includes GitHub provider results and category metadata', async () => {
  const result = await gatherOsint('Jane Doe Travis County TX', {
    packageId: 'probate_heirship',
    fetchImpl: mockFetch,
    env: {},
    investigationInput: {
      subjectName: 'Jane Doe',
      county: 'Travis',
      state: 'TX',
      deathYear: '2023'
    }
  });

  assert.ok(result.providerHealth.some((provider) => provider.provider === 'github'));
  assert.ok(result.sources.some((source) => source.provider === 'github'));
  assert.ok(result.sources.some((source) => Array.isArray(source.osintCategories) && source.osintCategories.length > 0));
  assert.ok(result.sources.some((source) => Array.isArray(source.supportingRepos) && source.supportingRepos.length > 0));
});
