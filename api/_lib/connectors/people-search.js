/**
 * Connector: people-search
 * Searches TruePeopleSearch and FastPeopleSearch for individual identity,
 * current address, phone numbers, and known associates.
 */

import { truePeopleSearchScraper, fastPeopleSearchScraper } from '../source-modules.js';

export const connectorName = 'people-search';
export const description = 'Queries TruePeopleSearch and FastPeopleSearch for individual identity records including current addresses, phone numbers, and known associates.';
export const inputSchema = {
  required: ['firstName', 'lastName'],
  optional: ['state', 'fetchImpl'],
};
export const rateLimit = { maxPerMinute: 20, concurrency: 2 };

export async function runConnector({ firstName, lastName, state = 'TX', fetchImpl = fetch }) {
  const [tpsResult, fpsResult] = await Promise.all([
    truePeopleSearchScraper(firstName, lastName, state, fetchImpl),
    fastPeopleSearchScraper(firstName, lastName, state, fetchImpl),
  ]);

  const tpsPeople = tpsResult.status === 'found' ? (tpsResult.data?.people || []) : [];
  const fpsPeople = fpsResult.status === 'found' ? (fpsResult.data?.people || []) : [];

  // Merge and deduplicate by name
  const seen = new Set();
  const merged = [...tpsPeople, ...fpsPeople].filter((p) => {
    const key = (p.name || '').toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const found = merged.length > 0;

  return {
    source: connectorName,
    success: found,
    results: merged,
    evidence: merged.map((p) => ({
      type: 'identity_record',
      label: p.name || `${firstName} ${lastName}`,
      confidence: (p.addresses?.length > 0 && p.phones?.length > 0) ? 'likely' : 'possible',
      data: p,
      sourceLabel: 'TruePeopleSearch / FastPeopleSearch',
      sourceUrl: `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(`${firstName} ${lastName}`)}&citystatezip=${encodeURIComponent(state)}`,
    })),
    errors: [
      ...(tpsResult.status === 'error' ? [`TruePeopleSearch: ${tpsResult.errorDetail}`] : []),
      ...(fpsResult.status === 'error' ? [`FastPeopleSearch: ${fpsResult.errorDetail}`] : []),
    ],
    sourceResults: [tpsResult, fpsResult],
  };
}
