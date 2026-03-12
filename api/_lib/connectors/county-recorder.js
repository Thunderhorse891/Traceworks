/**
 * Connector: county-recorder
 * Queries county clerk deed indexes for grantor/grantee deed records.
 * County deed portals require browser sessions; returns manual-review notices.
 */

import { countyDeedIndexUnavailable, duckDuckGoSearch } from '../source-modules.js';

export const connectorName = 'county-recorder';
export const description = 'Searches county clerk deed and recorder indexes for deed transfers, grantor/grantee chains, and recording instrument data.';
export const inputSchema = {
  required: ['county', 'query'],
  optional: ['state', 'fetchImpl'],
};
export const rateLimit = { maxPerMinute: 20, concurrency: 2 };

export async function runConnector({ county, query, state = 'TX', fetchImpl = fetch }) {
  const [deedResult, ddgResult] = await Promise.all([
    Promise.resolve(countyDeedIndexUnavailable(county, state, query)),
    duckDuckGoSearch(
      `"${query}" deed record ${county} county ${state} site:*.gov OR site:*.org grantor grantee`,
      fetchImpl
    ),
  ]);

  const ddgResults = ddgResult.status === 'found' ? (ddgResult.data?.results || []) : [];
  const found = ddgResults.length > 0;

  return {
    source: connectorName,
    success: found,
    results: ddgResults,
    evidence: ddgResults.map((r) => ({
      type: 'deed_record_signal',
      label: r.title,
      confidence: 'possible',
      data: r,
      sourceLabel: 'DuckDuckGo Deed Index Signal',
      sourceUrl: r.url,
    })),
    errors: [],
    sourceResults: [deedResult, ddgResult],
    manualReviewUrl: `https://www.${county.toLowerCase()}countyclerk.${state.toLowerCase()}.gov/`,
    manualReviewNote: deedResult.errorDetail,
  };
}
