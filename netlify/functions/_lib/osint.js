import { gatherPublicRecordIntel } from './public-records.js';
import { canonicalPackageId, openWebKeywordsForPackage } from './package-contract.js';
import { resolveApifyOsintConfig, resolveFirecrawlConfig } from './osint-config.js';
import { getPackage } from './packages.js';
import { OSINT_REPO_MAP } from './osintRepoMap.js';

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'unknown';
  }
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function uniqueRepoReferences(repos = []) {
  const byKey = new Map();
  for (const repo of repos) {
    const key = String(repo?.slug || repo?.url || '').trim();
    if (!key || byKey.has(key)) continue;
    byKey.set(key, repo);
  }
  return [...byKey.values()];
}

function confidenceScore(label) {
  if (label === 'high') return 3;
  if (label === 'medium') return 2;
  return 1;
}

function sourceTypeScore(type) {
  if (type === 'official-record') return 7;
  if (type === 'legal-intel') return 6;
  if (type === 'business-registry') return 5;
  if (type === 'search-scrape') return 4;
  if (type === 'search-index') return 3;
  if (type === 'open-web') return 2;
  if (type === 'knowledge-base') return 1;
  if (type === 'community-intel') return 0;
  return 1;
}

function providerScore(provider) {
  if (provider === 'firecrawl') return 6;
  if (provider === 'apify') return 5;
  if (provider === 'robin') return 4;
  if (provider === 'github') return 4;
  if (provider === 'opencorporates') return 3;
  if (provider === 'duckduckgo') return 2;
  if (provider === 'wikipedia') return 1;
  if (provider === 'reddit') return 0;
  return 1;
}

function compareRecordQuality(left, right) {
  const confidenceDiff = confidenceScore(left.confidence) - confidenceScore(right.confidence);
  if (confidenceDiff !== 0) return confidenceDiff;

  const typeDiff = sourceTypeScore(left.sourceType) - sourceTypeScore(right.sourceType);
  if (typeDiff !== 0) return typeDiff;

  const providerDiff = providerScore(left.provider) - providerScore(right.provider);
  if (providerDiff !== 0) return providerDiff;

  return right.domain.localeCompare(left.domain);
}

async function fetchJson(url, fetchImpl, timeoutMs = 9000, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      let detail = '';
      try {
        const body = typeof res.json === 'function' ? await res.json() : null;
        detail = body?.error || body?.message || '';
      } catch {
        if (typeof res.text === 'function') {
          try {
            detail = await res.text();
          } catch {}
        }
      }
      throw new Error(detail ? `HTTP ${res.status}: ${detail}` : `HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeRecord(record, provider, fallbackType = 'open-web') {
  const url = record.url || record.FirstURL || '';
  if (!url) return null;
  return {
    title: (record.title || record.Text || record.name || 'Public web record').trim(),
    url,
    sourceType: record.sourceType || fallbackType,
    confidence: record.confidence || 'medium',
    provider,
    domain: domainOf(url)
  };
}

async function fromDuckDuckGo(query, fetchImpl) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const data = await fetchJson(url, fetchImpl);
  const related = Array.isArray(data.RelatedTopics) ? data.RelatedTopics : [];
  return related
    .flatMap((r) => (Array.isArray(r.Topics) ? r.Topics : [r]))
    .map((item) => normalizeRecord(item, 'duckduckgo', 'open-web'))
    .filter(Boolean)
    .slice(0, 8);
}

async function fromWikipediaSearch(query, fetchImpl) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
  const data = await fetchJson(url, fetchImpl);
  const rows = Array.isArray(data?.query?.search) ? data.query.search : [];
  return rows.slice(0, 5).map((row) =>
    normalizeRecord(
      {
        title: row.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(row.title.replaceAll(' ', '_'))}`,
        sourceType: 'knowledge-base',
        confidence: 'low'
      },
      'wikipedia'
    )
  );
}

async function fromRedditSearch(query, fetchImpl) {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=5&sort=relevance`;
  const data = await fetchJson(url, fetchImpl);
  const posts = Array.isArray(data?.data?.children) ? data.data.children : [];
  return posts
    .slice(0, 5)
    .map((post) => {
      const d = post?.data || {};
      return normalizeRecord(
        {
          title: d.title || 'Community signal',
          url: `https://www.reddit.com${d.permalink || ''}`,
          sourceType: 'community-intel',
          confidence: 'low'
        },
        'reddit'
      );
    })
    .filter(Boolean);
}

async function fromOpenCorporates(query, fetchImpl) {
  const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(query)}&per_page=5`;
  const data = await fetchJson(url, fetchImpl);
  const rows = Array.isArray(data?.results?.companies) ? data.results.companies : [];
  return rows
    .map((item) => item?.company)
    .filter(Boolean)
    .map((company) =>
      normalizeRecord(
        {
          title: company.name || 'OpenCorporates company record',
          url: company.opencorporates_url || '',
          sourceType: 'business-registry',
          confidence: 'medium'
        },
        'opencorporates'
      )
    )
    .filter(Boolean);
}

async function fromGitHubRepositories(query, fetchImpl, env) {
  const url = new URL('https://api.github.com/search/repositories');
  url.searchParams.set('q', query);
  url.searchParams.set('sort', 'updated');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', '5');

  const token = String(env?.GITHUB_TOKEN || env?.GH_TOKEN || '').trim();
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'TraceWorks-OSINT'
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const data = await fetchJson(url.toString(), fetchImpl, 10_000, { headers });
  const rows = Array.isArray(data?.items) ? data.items : [];
  return rows
    .map((repo) =>
      normalizeRecord(
        {
          title: repo.full_name || repo.name || 'GitHub repository result',
          url: repo.html_url,
          sourceType: 'search-index',
          confidence: repo.stargazers_count > 0 ? 'medium' : 'low'
        },
        'github'
      )
    )
    .filter(Boolean);
}

async function fromRobin(query, fetchImpl, env) {
  const base = String(env?.ROBIN_API_URL || '').trim();
  if (!base) throw new Error('ROBIN_API_URL is not configured');

  const apiKey = String(env?.ROBIN_API_KEY || '').trim();
  const url = `${base.replace(/\/$/, '')}/search?q=${encodeURIComponent(query)}`;
  const headers = apiKey ? { authorization: `Bearer ${apiKey}` } : {};
  const data = await fetchJson(url, fetchImpl, 10_000, { headers });
  const rows = Array.isArray(data?.results) ? data.results : [];

  return rows
    .map((row) =>
      normalizeRecord(
        {
          title: row.title || row.name || 'Robin intelligence result',
          url: row.url,
          sourceType: row.sourceType || 'legal-intel',
          confidence: row.confidence || 'high'
        },
        'robin'
      )
    )
    .filter(Boolean)
    .slice(0, 10);
}

function investigationInputFromOpts(opts = {}) {
  return opts.investigationInput || opts.publicRecordOrder?.input || {};
}

function firecrawlLocation(opts = {}) {
  if (String(opts.location || '').trim()) return String(opts.location).trim();
  const input = investigationInputFromOpts(opts);
  const county = String(input.county || '').trim();
  const state = String(input.state || '').trim();
  if (!county && !state) return '';
  if (county && state) return `${county} County, ${state}, United States`;
  return state ? `${state}, United States` : '';
}

function normalizeFirecrawlRows(data) {
  const rows = Array.isArray(data?.data?.web)
    ? data.data.web
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.results)
        ? data.results
        : [];

  return rows
    .map((row) =>
      normalizeRecord(
        {
          title: row.title || row.metadata?.title || row.description || row.markdown || 'Firecrawl search result',
          url: row.url || row.link,
          sourceType: row.markdown ? 'search-scrape' : 'search-index',
          confidence: row.markdown ? 'medium' : 'low'
        },
        'firecrawl'
      )
    )
    .filter(Boolean);
}

async function fromFirecrawl(query, fetchImpl, env, opts = {}) {
  const config = resolveFirecrawlConfig(env);
  if (!config.configured) throw new Error('FIRECRAWL_API_KEY is not configured');

  const body = {
    query,
    limit: config.resultLimit,
    country: config.country
  };
  const location = firecrawlLocation(opts);
  if (location) body.location = location;
  if (config.scrapeResults) {
    body.scrapeOptions = {
      formats: ['markdown'],
      onlyMainContent: true
    };
  }

  const data = await fetchJson(`${config.apiBaseUrl.replace(/\/$/, '')}/search`, fetchImpl, config.timeoutMs, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body)
  });

  return normalizeFirecrawlRows(data).slice(0, config.resultLimit);
}

function fillTemplateValue(value, tokens) {
  if (Array.isArray(value)) return value.map((item) => fillTemplateValue(item, tokens));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fillTemplateValue(item, tokens)]));
  }
  if (typeof value !== 'string') return value;
  return value.replace(/\{(\w+)\}/g, (_, key) => String(tokens[key] ?? ''));
}

function buildApifyInput(query, packageId, config, opts = {}) {
  const tokens = {
    query,
    packageId,
    limit: config.resultLimit,
    location: firecrawlLocation(opts),
    country: resolveFirecrawlConfig(opts.env || process.env).country
  };
  if (config.inputTemplate) return fillTemplateValue(config.inputTemplate, tokens);
  return { queries: query };
}

function flattenApifyItems(items = []) {
  return items.flatMap((item) => {
    if (Array.isArray(item?.nonPromotedSearchResults)) return item.nonPromotedSearchResults;
    if (Array.isArray(item?.organicResults)) return item.organicResults;
    if (Array.isArray(item?.results)) return item.results;
    return [item];
  });
}

function normalizeApifyRows(items) {
  return flattenApifyItems(items)
    .map((row) =>
      normalizeRecord(
        {
          title: row.title || row.name || row.description || row.snippet || 'Apify search result',
          url: row.url || row.link,
          sourceType: row.sourceType || 'search-index',
          confidence: row.confidence || 'medium'
        },
        'apify'
      )
    )
    .filter(Boolean);
}

async function fromApify(query, fetchImpl, env, opts = {}) {
  const config = resolveApifyOsintConfig(env);
  if (!config.configured) throw new Error('APIFY_API_TOKEN is not configured');
  if (config.templateError) throw new Error(config.templateError);

  const url = new URL(`${config.apiBaseUrl.replace(/\/$/, '')}/acts/${config.actorId}/run-sync-get-dataset-items`);
  url.searchParams.set('clean', '1');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(config.resultLimit));
  url.searchParams.set('timeout', String(config.timeoutSeconds));

  const data = await fetchJson(url.toString(), fetchImpl, Math.max(10_000, config.timeoutSeconds * 1000 + 5_000), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.token}`
    },
    body: JSON.stringify(buildApifyInput(query, canonicalPackageId(opts.packageId || 'standard') || 'standard', config, { ...opts, env }))
  });

  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return normalizeApifyRows(items).slice(0, config.resultLimit);
}

function packageOsintCategories(packageId) {
  const pkg = getPackage(packageId);
  return Array.isArray(pkg?.osintCategories) ? uniqueStrings(pkg.osintCategories) : [];
}

function buildQueries(query, packageId) {
  const base = (query || 'subject public records').trim();
  const extras = openWebKeywordsForPackage(packageId);
  const queries = [base, ...extras.map((k) => `${base} ${k}`)];
  return [...new Set(queries)].slice(0, 6);
}

function categoryTokens(query, opts = {}) {
  const input = investigationInputFromOpts(opts);
  const location = firecrawlLocation(opts);
  return {
    query: String(query || '').trim(),
    subject: String(input.subjectName || query || '').trim(),
    address: String(input.lastKnownAddress || input.address || '').trim(),
    parcelId: String(input.parcelId || input.parcel || '').trim(),
    county: String(input.county || '').trim(),
    state: String(input.state || '').trim(),
    deathYear: String(input.deathYear || '').trim(),
    location
  };
}

function buildCategoryQueries(categoryId, query, opts = {}) {
  const config = OSINT_REPO_MAP[categoryId];
  if (!config) return [];
  const tokens = categoryTokens(query, opts);
  const templateQueries = (config.queryTemplates || [])
    .map((template) => fillTemplateValue(template, tokens).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const keywordQueries = (config.keywords || [])
    .map((keyword) => [tokens.query, keyword].filter(Boolean).join(' ').trim())
    .filter(Boolean);
  return uniqueStrings([...templateQueries, ...keywordQueries]).slice(0, 6);
}

function annotateHit(record, extras = {}) {
  return {
    ...record,
    osintCategories: uniqueStrings([...(record.osintCategories || []), ...(extras.osintCategories || [])]),
    supportingRepos: uniqueRepoReferences([...(record.supportingRepos || []), ...(extras.supportingRepos || [])]),
    matchedQueries: uniqueStrings([...(record.matchedQueries || []), ...(extras.matchedQueries || [])])
  };
}

function categoryRelevanceScore(record, packageCategories = []) {
  const categories = Array.isArray(record?.osintCategories) ? record.osintCategories : [];
  const matches = categories.filter((category) => packageCategories.includes(category)).length;
  return matches;
}

function dedupeAndRank(records, packageCategories = []) {
  const byUrl = new Map();
  for (const record of records) {
    if (!record?.url) continue;
    const key = record.url.trim().toLowerCase();
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, annotateHit(record));
      continue;
    }

    const preferred = compareRecordQuality(record, existing) > 0 ? record : existing;
    const merged = annotateHit(preferred, {
      osintCategories: [...(existing.osintCategories || []), ...(record.osintCategories || [])],
      supportingRepos: [...(existing.supportingRepos || []), ...(record.supportingRepos || [])],
      matchedQueries: [...(existing.matchedQueries || []), ...(record.matchedQueries || [])]
    });
    byUrl.set(key, merged);
  }

  return [...byUrl.values()]
    .sort((a, b) => {
      const categoryDiff = categoryRelevanceScore(b, packageCategories) - categoryRelevanceScore(a, packageCategories);
      if (categoryDiff !== 0) return categoryDiff;
      const qualityDiff = compareRecordQuality(b, a);
      if (qualityDiff !== 0) return qualityDiff;
      return a.domain.localeCompare(b.domain);
    })
    .slice(0, 18);
}

function providerHealth(results) {
  const providers = new Map();

  for (const item of results) {
    const current = providers.get(item.provider) || {
      provider: item.provider,
      ok: false,
      hitCount: 0,
      attempts: 0,
      errors: []
    };

    current.ok = current.ok || item.ok;
    current.hitCount += item.hits.length;
    current.attempts += 1;
    if (item.error && !current.errors.includes(item.error)) current.errors.push(item.error);
    providers.set(item.provider, current);
  }

  return [...providers.values()].map((item) => ({
    provider: item.provider,
    ok: item.ok,
    hitCount: item.hitCount,
    attempts: item.attempts,
    error: item.errors.length ? item.errors.join('; ') : null
  }));
}

function buildProviders(env, opts = {}) {
  const providers = [
    { name: 'duckduckgo', fn: fromDuckDuckGo },
    { name: 'wikipedia', fn: fromWikipediaSearch },
    { name: 'reddit', fn: fromRedditSearch },
    { name: 'opencorporates', fn: fromOpenCorporates },
    { name: 'github', fn: (query, fetchImpl) => fromGitHubRepositories(query, fetchImpl, env) }
  ];

  if (String(env?.ROBIN_API_URL || '').trim()) {
    providers.push({ name: 'robin', fn: (query, fetchImpl) => fromRobin(query, fetchImpl, env) });
  }

  if (resolveFirecrawlConfig(env).configured) {
    providers.push({ name: 'firecrawl', fn: (query, fetchImpl) => fromFirecrawl(query, fetchImpl, env, opts) });
  }

  if (resolveApifyOsintConfig(env).configured) {
    providers.push({ name: 'apify', fn: (query, fetchImpl) => fromApify(query, fetchImpl, env, { ...opts, packageId: opts.packageId }) });
  }

  return providers;
}

async function runQueriesAcrossProviders(queries, providers, fetchImpl) {
  const settled = [];
  for (const q of queries) {
    const runs = await Promise.all(
      providers.map(async (provider) => {
        try {
          const hits = await provider.fn(q, fetchImpl);
          return { provider: provider.name, ok: true, hits, query: q };
        } catch (error) {
          return { provider: provider.name, ok: false, hits: [], error: String(error.message || error), query: q };
        }
      })
    );
    settled.push(...runs);
  }
  return settled;
}

async function runCategoryOsint(categoryId, baseQuery, providers, fetchImpl, opts = {}) {
  const config = OSINT_REPO_MAP[categoryId];
  if (!config) {
    return {
      categoryId,
      label: categoryId,
      queryPlan: [],
      repoReferences: [],
      providerHealth: [],
      sources: []
    };
  }

  const queryPlan = buildCategoryQueries(categoryId, baseQuery, opts);
  if (!queryPlan.length) {
    return {
      categoryId,
      label: config.label || categoryId,
      queryPlan: [],
      repoReferences: config.repos || [],
      providerHealth: [],
      sources: []
    };
  }

  const settled = await runQueriesAcrossProviders(queryPlan, providers, fetchImpl);
  const sources = dedupeAndRank(
    settled.flatMap((result) =>
      result.hits.map((hit) => annotateHit(hit, {
        osintCategories: [categoryId],
        supportingRepos: config.repos || [],
        matchedQueries: [result.query]
      }))
    ),
    [categoryId]
  );

  return {
    categoryId,
    label: config.label || categoryId,
    queryPlan,
    repoReferences: config.repos || [],
    providerHealth: providerHealth(settled),
    sources
  };
}

export async function gatherOsint(query, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const env = opts.env || process.env;
  const packageId = canonicalPackageId(opts.packageId || 'standard') || 'standard';
  const queries = buildQueries(query, packageId);
  const providers = buildProviders(env, { ...opts, packageId });
  const osintCategories = uniqueStrings(opts.osintCategories || packageOsintCategories(packageId));

  const settled = await runQueriesAcrossProviders(queries, providers, fetchImpl);
  const generalHits = settled.flatMap((result) =>
    result.hits.map((hit) => annotateHit(hit, { matchedQueries: [result.query] }))
  );

  const categoryResults = [];
  for (const categoryId of osintCategories) {
    categoryResults.push(await runCategoryOsint(categoryId, query, providers, fetchImpl, { ...opts, packageId }));
  }

  const aggregated = dedupeAndRank([
    ...generalHits,
    ...categoryResults.flatMap((result) => result.sources)
  ], osintCategories);
  const health = providerHealth(settled);
  const healthyProviders = new Set(
    [...health, ...categoryResults.flatMap((result) => result.providerHealth)].filter((item) => item.hitCount > 0).map((item) => item.provider)
  );
  const repoReferences = uniqueRepoReferences(categoryResults.flatMap((result) => result.repoReferences || []));

  let publicRecords = null;
  if (opts.publicRecordOrder) {
    publicRecords = await gatherPublicRecordIntel(
      {
        ...opts.publicRecordOrder,
        packageKey: canonicalPackageId(opts.publicRecordOrder.packageKey || opts.publicRecordOrder.packageId || packageId) || packageId
      },
      { fetchImpl, env }
    );
  }

  const providerNoteParts = [];
  if (aggregated.length > 0) {
    providerNoteParts.push(`Open-web OSINT returned ${aggregated.length} cited lead(s) across ${healthyProviders.size} provider(s).`);
  } else {
    providerNoteParts.push('No open-web OSINT providers returned sourceable hits for this query plan in this run.');
  }
  if (categoryResults.length) {
    providerNoteParts.push(`Repo-mapped category scrapers executed ${categoryResults.length} category plan(s) backed by ${repoReferences.length} GitHub repo reference(s).`);
  }
  if (publicRecords?.evidence?.length) {
    providerNoteParts.push(`Structured public-record connectors returned ${publicRecords.evidence.length} evidence item(s).`);
  }

  return {
    query: queries[0],
    packageId,
    osintCategories,
    queryPlan: queries,
    providerHealth: health,
    providerNote: providerNoteParts.join(' '),
    coverage: {
      totalSources: aggregated.length + (publicRecords?.evidence?.length || 0),
      totalOpenWebSources: aggregated.length,
      totalStructuredEvidence: publicRecords?.evidence?.length || 0,
      totalRepoCategoryRuns: categoryResults.length,
      distinctDomains: new Set(aggregated.map((s) => s.domain || domainOf(s.url))).size,
      providersWithHits: healthyProviders.size
    },
    repoReferences,
    repoCategoryResults: categoryResults,
    sources: aggregated,
    evidence: publicRecords?.evidence || [],
    publicRecords
  };
}
