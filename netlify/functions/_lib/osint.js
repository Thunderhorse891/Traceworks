import { gatherPublicRecordIntel } from './public-records.js';

const PACKAGE_KEYWORDS = {
  locate: ["current address", "phone", "alias", "contact"],
  comprehensive: ["assets", "property", "employment", "business filings"],
  title: ["title", "deed", "lien", "operator", "royalty"],
  heir: ["probate", "heir", "beneficiary", "next of kin"]
};

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "unknown";
  }
}

function confidenceScore(label) {
  if (label === "high") return 3;
  if (label === "medium") return 2;
  return 1;
}

async function fetchJson(url, fetchImpl, timeoutMs = 9000, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeRecord(record, provider, fallbackType = "open-web") {
  const url = record.url || record.FirstURL || "";
  if (!url) return null;
  return {
    title: (record.title || record.Text || record.name || "Public web record").trim(),
    url,
    sourceType: record.sourceType || fallbackType,
    confidence: record.confidence || "medium",
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
    .map((item) => normalizeRecord(item, "duckduckgo", "open-web"))
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
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(row.title.replaceAll(" ", "_"))}`,
        sourceType: "knowledge-base",
        confidence: "low"
      },
      "wikipedia"
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
          title: d.title || "Community signal",
          url: `https://www.reddit.com${d.permalink || ""}`,
          sourceType: "community-intel",
          confidence: "low"
        },
        "reddit"
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
          title: company.name || "OpenCorporates company record",
          url: company.opencorporates_url || "",
          sourceType: "business-registry",
          confidence: "medium"
        },
        "opencorporates"
      )
    )
    .filter(Boolean);
}

async function fromRobin(query, fetchImpl, env) {
  const base = String(env?.ROBIN_API_URL || "").trim();
  if (!base) throw new Error("ROBIN_API_URL is not configured");

  const apiKey = String(env?.ROBIN_API_KEY || "").trim();
  const url = `${base.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}`;
  const headers = apiKey ? { authorization: `Bearer ${apiKey}` } : {};
  const data = await fetchJson(url, fetchImpl, 10_000, { headers });
  const rows = Array.isArray(data?.results) ? data.results : [];

  return rows
    .map((row) =>
      normalizeRecord(
        {
          title: row.title || row.name || "Robin intelligence result",
          url: row.url,
          sourceType: row.sourceType || "legal-intel",
          confidence: row.confidence || "high"
        },
        "robin"
      )
    )
    .filter(Boolean)
    .slice(0, 10);
}

function buildQueries(query, packageId) {
  const base = (query || "subject locate public records").trim();
  const extras = PACKAGE_KEYWORDS[packageId] || [];
  const queries = [base, ...extras.map((k) => `${base} ${k}`)];
  return [...new Set(queries)].slice(0, 6);
}

function dedupeAndRank(records) {
  const byUrl = new Map();
  for (const record of records) {
    if (!record?.url) continue;
    const key = record.url.trim().toLowerCase();
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, record);
      continue;
    }
    if (confidenceScore(record.confidence) > confidenceScore(existing.confidence)) {
      byUrl.set(key, record);
    }
  }

  return [...byUrl.values()]
    .sort((a, b) => {
      const scoreDiff = confidenceScore(b.confidence) - confidenceScore(a.confidence);
      if (scoreDiff !== 0) return scoreDiff;
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
    error: item.errors.length ? item.errors.join("; ") : null
  }));
}

function buildProviders(env) {
  const providers = [
    { name: "duckduckgo", fn: fromDuckDuckGo },
    { name: "wikipedia", fn: fromWikipediaSearch },
    { name: "reddit", fn: fromRedditSearch },
    { name: "opencorporates", fn: fromOpenCorporates }
  ];

  if (String(env?.ROBIN_API_URL || "").trim()) {
    providers.push({ name: "robin", fn: (query, fetchImpl) => fromRobin(query, fetchImpl, env) });
  }

  return providers;
}

export async function gatherOsint(query, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const env = opts.env || process.env;
  const packageId = opts.packageId || "locate";
  const queries = buildQueries(query, packageId);
  const providers = buildProviders(env);

  const settled = [];
  for (const q of queries) {
    const runs = await Promise.all(
      providers.map(async (provider) => {
        try {
          const hits = await provider.fn(q, fetchImpl);
          return { provider: provider.name, ok: true, hits };
        } catch (error) {
          return { provider: provider.name, ok: false, hits: [], error: String(error.message || error) };
        }
      })
    );
    settled.push(...runs);
  }

  const aggregated = dedupeAndRank(settled.flatMap((r) => r.hits));
  const health = providerHealth(settled);
  const healthyProviders = new Set(health.filter((h) => h.hitCount > 0).map((h) => h.provider));

  let publicRecords = null;
  if (opts.publicRecordOrder) {
    publicRecords = await gatherPublicRecordIntel(opts.publicRecordOrder, { fetchImpl, env });
  }

  const providerNoteParts = [];
  if (aggregated.length > 0) {
    providerNoteParts.push(`Open-web OSINT returned ${aggregated.length} cited lead(s) across ${healthyProviders.size} provider(s).`);
  } else {
    providerNoteParts.push("No open-web OSINT providers returned sourceable hits for this query plan in this run.");
  }
  if (publicRecords?.evidence?.length) {
    providerNoteParts.push(`Structured public-record connectors returned ${publicRecords.evidence.length} evidence item(s).`);
  }

  return {
    query: queries[0],
    queryPlan: queries,
    providerHealth: health,
    providerNote: providerNoteParts.join(" "),
    coverage: {
      totalSources: aggregated.length,
      distinctDomains: new Set(aggregated.map((s) => s.domain || domainOf(s.url))).size,
      providersWithHits: healthyProviders.size
    },
    sources: aggregated,
    evidence: publicRecords?.evidence || [],
    publicRecords
  };
}
