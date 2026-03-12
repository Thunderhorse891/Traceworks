/**
 * Connector: domain-records
 * Searches public WHOIS/RDAP and domain registration records for business intelligence.
 *
 * Sources used (all free, no API keys):
 *   • whoisRdapLookup  — rdap.org JSON API (ICANN RDAP standard)
 *   • waybackLookup    — Wayback Machine CDX API (historical snapshots)
 *   • duckDuckGoSearch — DuckDuckGo HTML scrape (web intelligence signals)
 *
 * whoisRdapLookup replaces the previous inline rdapLookup function and adds
 * support for IP RDAP, improved entity parsing, and org/CIDR/country fields.
 */

import { duckDuckGoSearch, whoisRdapLookup, waybackLookup } from '../source-modules.js';

export const connectorName = 'domain-records';
export const description = 'Queries ICANN RDAP (via rdap.org), Wayback Machine CDX, and DuckDuckGo for domain registration, registrant identity, historical snapshots, and hosting intelligence. No API key required.';
export const inputSchema = {
  required: ['domain'],
  optional: ['subjectName', 'fetchImpl'],
};
export const rateLimit = { maxPerMinute: 20, concurrency: 3 };

export async function runConnector({ domain, subjectName = '', fetchImpl = fetch }) {
  // Normalize domain: strip protocol and path
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase().trim();

  const [rdapResult, waybackResult, ddgResult] = await Promise.all([
    whoisRdapLookup(cleanDomain, fetchImpl),
    waybackLookup(cleanDomain, fetchImpl),
    duckDuckGoSearch(`"${cleanDomain}" ${subjectName} domain owner registrant`.trim(), fetchImpl),
  ]);

  const rdapData      = rdapResult.status === 'found' ? [rdapResult.data] : [];
  const waybackSnaps  = waybackResult.status === 'found' ? (waybackResult.data?.snapshots || []) : [];
  const ddgSignals    = ddgResult.status === 'found' ? (ddgResult.data?.results || []) : [];
  const found         = rdapData.length > 0 || waybackSnaps.length > 0 || ddgSignals.length > 0;

  const icannLookupUrl = `https://lookup.icann.org/en/lookup?name=${encodeURIComponent(cleanDomain)}`;

  return {
    source:  connectorName,
    success: found,
    results: [...rdapData, ...ddgSignals],
    evidence: [
      // RDAP registration evidence
      ...rdapData.map((d) => ({
        type:        'domain_registration',
        label:       `${d.query} — Registered ${d.created ? d.created.split('T')[0] : 'unknown'}${d.registrant ? ` — Registrant: ${d.registrant}` : ''}${d.org ? ` (${d.org})` : ''}`,
        confidence:  rdapResult.confidence,
        data:        d,
        sourceLabel: 'WHOIS/RDAP (rdap.org)',
        sourceUrl:   icannLookupUrl,
      })),
      // Wayback snapshot summary evidence
      ...(waybackSnaps.length > 0 ? [{
        type:        'historical_snapshots',
        label:       `Wayback Machine — ${waybackSnaps.length} snapshots for ${cleanDomain} (earliest: ${waybackSnaps.at(-1)?.timestamp?.split('T')[0] || 'unknown'})`,
        confidence:  'confirmed',
        data:        { domain: cleanDomain, snapshot_count: waybackSnaps.length, snapshots: waybackSnaps.slice(0, 3) },
        sourceLabel: 'Wayback Machine CDX API',
        sourceUrl:   `https://web.archive.org/web/*/${cleanDomain}`,
      }] : []),
      // DuckDuckGo web intel signals
      ...ddgSignals.slice(0, 3).map((r) => ({
        type:        'domain_intel_signal',
        label:       r.title,
        confidence:  'possible',
        data:        r,
        sourceLabel: 'DuckDuckGo Domain Signal',
        sourceUrl:   r.url,
      })),
    ],
    errors: [
      ...(rdapResult.status === 'error' ? [rdapResult.errorDetail] : []),
      ...(waybackResult.status === 'error' ? [waybackResult.errorDetail] : []),
    ].filter(Boolean),
    sourceResults: [rdapResult, waybackResult, ddgResult],
  };
}
