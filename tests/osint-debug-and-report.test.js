import test from 'node:test';
import assert from 'node:assert/strict';

import { buildOsintDebug } from '../netlify/functions/admin-case-debug.js';
import { appendRepoCategoryPanel, buildRepoCategoryPanel } from '../netlify/functions/_lib/fulfillment.js';

const SAMPLE_ORDER = {
  caseRef: 'TW-CASE-123',
  packageId: 'probate_heirship',
  status: 'manual_review',
  subjectName: 'Jane Doe',
  county: 'Travis',
  state: 'TX',
  workflow_results: {
    tier: 'probate_heirship',
    inputs: {
      subjectName: 'Jane Doe',
      county: 'Travis',
      state: 'TX'
    },
    osint: {
      packageId: 'probate_heirship',
      osintCategories: ['probate', 'obituary'],
      preferredProviders: ['firecrawl', 'github', 'duckduckgo'],
      queryPlan: ['Jane Doe Travis County TX probate case', 'Jane Doe obituary Travis County TX'],
      providerHealth: [
        { provider: 'github', ok: true, hitCount: 2, attempts: 2, error: null },
        { provider: 'duckduckgo', ok: true, hitCount: 1, attempts: 2, error: null }
      ],
      coverage: {
        totalSources: 3,
        totalOpenWebSources: 3,
        totalStructuredEvidence: 0,
        totalRepoCategoryRuns: 2,
        distinctDomains: 3,
        providersWithHits: 2
      },
      providerNote: 'Open-web OSINT returned 3 cited lead(s) across 2 provider(s).',
      repoReferences: [
        { slug: 'scrapy/scrapy', url: 'https://github.com/scrapy/scrapy' },
        { slug: 'microsoft/playwright', url: 'https://github.com/microsoft/playwright' }
      ],
      repoCategoryResults: [
        {
          categoryId: 'probate',
          label: 'Probate and estate docket search',
          preferredProviders: ['firecrawl', 'github'],
          queryPlan: ['Jane Doe Travis County TX probate case'],
          repoReferences: [
            { slug: 'scrapy/scrapy', url: 'https://github.com/scrapy/scrapy' }
          ],
          providerHealth: [
            { provider: 'github', ok: true, hitCount: 2, attempts: 1, error: null }
          ],
          sources: [
            {
              title: 'example/probate-scraper',
              url: 'https://github.com/example/probate-scraper',
              provider: 'github',
              domain: 'github.com',
              osintCategories: ['probate'],
              supportingRepos: [
                { slug: 'scrapy/scrapy', url: 'https://github.com/scrapy/scrapy' }
              ]
            }
          ]
        },
        {
          categoryId: 'obituary',
          label: 'Obituary and death notice search',
          preferredProviders: ['firecrawl', 'duckduckgo'],
          queryPlan: ['Jane Doe obituary Travis County TX'],
          repoReferences: [
            { slug: 'ArchiveBox/ArchiveBox', url: 'https://github.com/ArchiveBox/ArchiveBox' }
          ],
          providerHealth: [
            { provider: 'duckduckgo', ok: true, hitCount: 1, attempts: 1, error: null }
          ],
          sources: [
            {
              title: 'Jane Doe obituary',
              url: 'https://example.com/jane-doe-obit',
              provider: 'duckduckgo',
              domain: 'example.com',
              osintCategories: ['obituary'],
              supportingRepos: [
                { slug: 'ArchiveBox/ArchiveBox', url: 'https://github.com/ArchiveBox/ArchiveBox' }
              ]
            }
          ]
        }
      ],
      sources: [
        {
          title: 'example/probate-scraper',
          url: 'https://github.com/example/probate-scraper',
          provider: 'github',
          domain: 'github.com',
          osintCategories: ['probate'],
          supportingRepos: [
            { slug: 'scrapy/scrapy', url: 'https://github.com/scrapy/scrapy' }
          ]
        },
        {
          title: 'Jane Doe obituary',
          url: 'https://example.com/jane-doe-obit',
          provider: 'duckduckgo',
          domain: 'example.com',
          osintCategories: ['obituary'],
          supportingRepos: [
            { slug: 'ArchiveBox/ArchiveBox', url: 'https://github.com/ArchiveBox/ArchiveBox' }
          ]
        }
      ]
    }
  }
};

test('buildOsintDebug normalizes case debug payload for admin dashboard', () => {
  const debug = buildOsintDebug(SAMPLE_ORDER);
  assert.equal(debug.caseRef, 'TW-CASE-123');
  assert.equal(debug.packageId, 'probate_heirship');
  assert.equal(debug.subjectName, 'Jane Doe');
  assert.deepEqual(debug.osint.osintCategories, ['probate', 'obituary']);
  assert.deepEqual(debug.osint.preferredProviders, ['firecrawl', 'github', 'duckduckgo']);
  assert.equal(debug.osint.repoCategoryResults.length, 2);
  assert.equal(debug.osint.repoCategoryResults[0].sourceCount, 1);
  assert.equal(debug.osint.topSources.length, 2);
});

test('buildRepoCategoryPanel summarizes repo-mapped OSINT category runs', () => {
  const panel = buildRepoCategoryPanel(SAMPLE_ORDER.workflow_results);
  assert.ok(panel);
  assert.equal(panel.title, 'Repo-Mapped OSINT Category Runs');
  assert.ok(panel.items.some((item) => item.includes('Probate and estate docket search')));
  assert.ok(panel.items.some((item) => item.includes('Overall repo references used in this run')));
});

test('appendRepoCategoryPanel appends repo-mapped section without losing existing panels', () => {
  const report = {
    analysisPanels: [
      { title: 'Open-Web OSINT Enrichment', items: ['Existing panel'] }
    ]
  };
  const appended = appendRepoCategoryPanel(report, SAMPLE_ORDER.workflow_results);
  assert.equal(appended.analysisPanels.length, 2);
  assert.equal(appended.analysisPanels[0].title, 'Open-Web OSINT Enrichment');
  assert.equal(appended.analysisPanels[1].title, 'Repo-Mapped OSINT Category Runs');
});
