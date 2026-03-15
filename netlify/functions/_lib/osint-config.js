function trim(value) {
  return String(value || '').trim();
}

function isTruthy(value, fallback = false) {
  const normalized = trim(value).toLowerCase();
  if (!normalized) return fallback;
  return !['false', '0', 'off', 'no'].includes(normalized);
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseJsonTemplate(raw) {
  const text = trim(raw);
  if (!text) return { value: null, error: null };
  try {
    return { value: JSON.parse(text), error: null };
  } catch (error) {
    return { value: null, error: `APIFY_OSINT_INPUT_TEMPLATE must be valid JSON: ${String(error?.message || error)}` };
  }
}

export function resolveFirecrawlConfig(env = process.env) {
  const apiKey = trim(env.FIRECRAWL_API_KEY);
  return {
    configured: Boolean(apiKey),
    apiKey,
    apiBaseUrl: trim(env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev/v2'),
    resultLimit: clampInteger(env.FIRECRAWL_OSINT_RESULT_LIMIT, 4, 1, 10),
    timeoutMs: clampInteger(env.FIRECRAWL_OSINT_TIMEOUT_MS, 20_000, 5_000, 120_000),
    scrapeResults: isTruthy(env.FIRECRAWL_OSINT_SCRAPE_RESULTS, true),
    country: trim(env.FIRECRAWL_OSINT_COUNTRY || 'US')
  };
}

export function resolveApifyOsintConfig(env = process.env) {
  const token = trim(env.APIFY_API_TOKEN);
  const template = parseJsonTemplate(env.APIFY_OSINT_INPUT_TEMPLATE);
  return {
    configured: Boolean(token),
    token,
    actorId: trim(env.APIFY_OSINT_ACTOR_ID || 'apify~google-search-scraper'),
    apiBaseUrl: trim(env.APIFY_API_URL || 'https://api.apify.com/v2'),
    timeoutSeconds: clampInteger(env.APIFY_OSINT_TIMEOUT_SECONDS, 90, 10, 300),
    resultLimit: clampInteger(env.APIFY_OSINT_RESULT_LIMIT, 6, 1, 20),
    inputTemplate: template.value,
    templateError: template.error
  };
}

export function resolvePremiumOsintConfig(env = process.env) {
  const firecrawl = resolveFirecrawlConfig(env);
  const apify = resolveApifyOsintConfig(env);
  return {
    firecrawl,
    apify,
    configuredProviders: [firecrawl.configured ? 'firecrawl' : '', apify.configured ? 'apify' : ''].filter(Boolean)
  };
}
