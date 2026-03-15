export class SourceAdapterError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SourceAdapterError';
    this.details = details;
  }
}

const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function defaultSourceTimeoutMs() {
  return Math.max(1000, Number(process.env.SOURCE_HTTP_TIMEOUT_MS || 8000));
}

function defaultSourceMaxRetries() {
  return Math.max(0, Math.min(4, Number(process.env.SOURCE_HTTP_MAX_RETRIES || 1)));
}

function defaultRetryDelayMs() {
  return Math.max(50, Number(process.env.SOURCE_HTTP_RETRY_DELAY_MS || 250));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(attempt) {
  return defaultRetryDelayMs() * Math.max(1, attempt + 1);
}

function mergeHeaders(headers = {}) {
  return {
    'user-agent': 'TraceWorks public records research',
    accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
    ...headers
  };
}

function isRetryableNetworkError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    error?.name === 'AbortError' ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('socket') ||
    message.includes('temporarily unavailable') ||
    message.includes('fetch failed')
  );
}

export async function fetchTextWithPolicy({
  url,
  method = 'GET',
  headers = {},
  body,
  fetchImpl = fetch,
  timeoutMs = defaultSourceTimeoutMs(),
  maxRetries = defaultSourceMaxRetries()
}) {
  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)
      : null;

    try {
      const res = await fetchImpl(url, {
        method,
        headers: mergeHeaders(headers),
        body,
        signal: controller?.signal
      });
      const text = await res.text();

      if (!res.ok && TRANSIENT_STATUSES.has(res.status) && attempt < maxRetries) {
        attempt += 1;
        await sleep(retryDelay(attempt));
        continue;
      }

      return { res, text, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries && isRetryableNetworkError(error)) {
        attempt += 1;
        await sleep(retryDelay(attempt));
        continue;
      }

      throw new SourceAdapterError(`Request failed for ${url}: ${String(error?.message || error)}`, {
        url,
        attempts: attempt + 1,
        classification: error?.name === 'AbortError' ? 'unavailable' : 'error'
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  throw new SourceAdapterError(`Request failed for ${url}: ${String(lastError?.message || lastError || 'unknown error')}`, {
    url,
    attempts: maxRetries + 1,
    classification: 'error'
  });
}

export function requireValue(name, value) {
  if (value === undefined || value === null || value === '') {
    throw new SourceAdapterError(`Missing required value: ${name}`, { field: name });
  }
  return value;
}

export function nowIso() {
  return new Date().toISOString();
}

export function buildEvidenceEntry({ sourceId, sourceName, query, url, status, notes, rawCount, extractedCount, attempts, durationMs }) {
  return {
    sourceId,
    sourceName,
    query,
    url,
    status,
    notes: notes || '',
    rawCount: rawCount ?? 0,
    extractedCount: extractedCount ?? 0,
    attempts: attempts ?? 1,
    durationMs: durationMs ?? null,
    timestamp: nowIso()
  };
}
