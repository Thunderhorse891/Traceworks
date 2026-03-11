/**
 * Connector: news-search
 * Searches public web and news indexes for subject mentions, litigation signals,
 * and reputational intelligence using DuckDuckGo.
 */

import { duckDuckGoSearch } from '../source-modules.js';

export const connectorName = 'news-search';
export const description = 'Searches public news indexes and web records for subject mentions, litigation signals, adverse press, and reputational intelligence.';
export const inputSchema = {
  required: ['query'],
  optional: ['subjectType', 'county', 'state', 'fetchImpl'],
};
export const rateLimit = { maxPerMinute: 30, concurrency: 4 };

const LITIGATION_TERMS = ['lawsuit', 'sued', 'plaintiff', 'defendant', 'judgment', 'lien', 'foreclosure', 'bankruptcy', 'fraud', 'indictment'];

function scoreLitigationSignal(title) {
  const lower = (title || '').toLowerCase();
  const hits = LITIGATION_TERMS.filter((t) => lower.includes(t));
  return { count: hits.length, terms: hits };
}

export async function runConnector({ query, subjectType = 'person', county = '', state = 'TX', fetchImpl = fetch }) {
  const queries = [
    query,
    `"${query}" lawsuit OR litigation OR judgment ${state}`,
    county ? `"${query}" ${county} county ${state} public record` : null,
  ].filter(Boolean);

  const results = await Promise.all(queries.map((q) => duckDuckGoSearch(q, fetchImpl)));

  const allHits = results.flatMap((r) => r.status === 'found' ? (r.data?.results || []) : []);

  // Deduplicate by URL
  const seen = new Set();
  const deduped = allHits.filter((h) => {
    if (!h.url || seen.has(h.url)) return false;
    seen.add(h.url);
    return true;
  });

  const found = deduped.length > 0;

  // Score litigation signals
  const litigationHits = deduped.filter((h) => scoreLitigationSignal(h.title).count > 0);

  return {
    source: connectorName,
    success: found,
    results: deduped,
    evidence: deduped.map((r) => {
      const lit = scoreLitigationSignal(r.title);
      return {
        type: lit.count > 0 ? 'litigation_signal' : 'news_mention',
        label: r.title,
        confidence: lit.count > 0 ? 'possible' : 'not_verified',
        data: { ...r, litigationTerms: lit.terms },
        sourceLabel: 'DuckDuckGo News/Web Index',
        sourceUrl: r.url,
        flagged: lit.count > 0,
      };
    }),
    errors: [],
    litigationSignalCount: litigationHits.length,
    sourceResults: results,
  };
}
