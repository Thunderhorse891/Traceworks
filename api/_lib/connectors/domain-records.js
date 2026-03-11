/**
 * Connector: domain-records
 * Searches public WHOIS and domain registration records for business intelligence.
 * Uses DuckDuckGo + RDAP public API (ICANN standard, no key required).
 */

import { duckDuckGoSearch } from '../source-modules.js';
import { makeSourceResult } from '../schema.js';

export const connectorName = 'domain-records';
export const description = 'Queries ICANN RDAP and public WHOIS indexes for domain registration, registrant identity, and hosting intelligence.';
export const inputSchema = {
  required: ['domain'],
  optional: ['subjectName', 'fetchImpl'],
};
export const rateLimit = { maxPerMinute: 20, concurrency: 3 };

const TIMEOUT_MS = 10000;

async function rdapLookup(domain, fetchImpl) {
  const queriedAt = new Date().toISOString();
  const rdapUrl = `https://rdap.verisign.com/com/v1/domain/${encodeURIComponent(domain)}`;
  const fallbackUrl = `https://rdap.org/domain/${encodeURIComponent(domain)}`;

  for (const url of [rdapUrl, fallbackUrl]) {
    try {
      const res = await fetchImpl(url, {
        headers: { 'Accept': 'application/rdap+json, application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const json = await res.json();

      const registrar = json.entities?.find((e) => e.roles?.includes('registrar'))?.vcardArray?.[1]
        ?.find((f) => f[0] === 'fn')?.[3] || null;
      const registrant = json.entities?.find((e) => e.roles?.includes('registrant'))?.vcardArray?.[1]
        ?.find((f) => f[0] === 'fn')?.[3] || null;
      const created = json.events?.find((e) => e.eventAction === 'registration')?.eventDate || null;
      const expires = json.events?.find((e) => e.eventAction === 'expiration')?.eventDate || null;
      const status = Array.isArray(json.status) ? json.status.join(', ') : (json.status || null);
      const nameservers = (json.nameservers || []).map((ns) => ns.ldhName).filter(Boolean);

      return makeSourceResult({
        sourceId: 'rdap',
        sourceLabel: 'ICANN RDAP Domain Registry',
        sourceUrl: url,
        queryUsed: domain,
        queriedAt,
        status: 'found',
        data: { domain, registrar, registrant, created, expires, status, nameservers },
        confidence: registrant ? 'likely' : 'possible',
      });
    } catch {
      // try fallback
    }
  }

  return makeSourceResult({
    sourceId: 'rdap',
    sourceLabel: 'ICANN RDAP Domain Registry',
    sourceUrl: rdapUrl,
    queryUsed: domain,
    queriedAt,
    status: 'unavailable',
    errorDetail: 'RDAP lookup failed — domain may not be publicly registered or TLD not supported',
    data: null,
    confidence: 'unavailable',
  });
}

export async function runConnector({ domain, subjectName = '', fetchImpl = fetch }) {
  // Normalize domain: strip protocol and path
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase().trim();

  const [rdapResult, ddgResult] = await Promise.all([
    rdapLookup(cleanDomain, fetchImpl),
    duckDuckGoSearch(`"${cleanDomain}" ${subjectName} domain owner registrant`, fetchImpl),
  ]);

  const rdapData = rdapResult.status === 'found' ? [rdapResult.data] : [];
  const ddgSignals = ddgResult.status === 'found' ? (ddgResult.data?.results || []) : [];
  const found = rdapData.length > 0 || ddgSignals.length > 0;

  return {
    source: connectorName,
    success: found,
    results: [...rdapData, ...ddgSignals],
    evidence: [
      ...rdapData.map((d) => ({
        type: 'domain_registration',
        label: `${d.domain} — Registered ${d.created ? d.created.split('T')[0] : 'unknown'}`,
        confidence: rdapResult.confidence,
        data: d,
        sourceLabel: 'ICANN RDAP',
        sourceUrl: `https://lookup.icann.org/en/lookup?name=${cleanDomain}`,
      })),
      ...ddgSignals.slice(0, 3).map((r) => ({
        type: 'domain_intel_signal',
        label: r.title,
        confidence: 'possible',
        data: r,
        sourceLabel: 'DuckDuckGo Domain Signal',
        sourceUrl: r.url,
      })),
    ],
    errors: rdapResult.status === 'error' ? [rdapResult.errorDetail] : [],
    sourceResults: [rdapResult, ddgResult],
  };
}
