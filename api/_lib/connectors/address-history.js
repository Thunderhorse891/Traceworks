/**
 * Connector: address-history
 * Extracts historical address chains from people search aggregators.
 * Specializes in address sequence reconstruction for skip-trace workflows.
 */

import { truePeopleSearchScraper, fastPeopleSearchScraper } from '../source-modules.js';

export const connectorName = 'address-history';
export const description = 'Reconstructs historical address chains for individuals using public aggregator data — supports skip-trace and locate investigations.';
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

  // Collect all addresses across all people records, preserving source attribution
  const addressRecords = [];

  for (const [result, source] of [[tpsResult, 'TruePeopleSearch'], [fpsResult, 'FastPeopleSearch']]) {
    if (result.status !== 'found') continue;
    for (const person of (result.data?.people || [])) {
      for (const addr of (person.addresses || [])) {
        addressRecords.push({
          address: addr,
          associatedName: person.name,
          source,
          phones: person.phones || [],
          relatives: person.relatives || [],
        });
      }
    }
  }

  // Deduplicate by address string
  const seen = new Set();
  const unique = addressRecords.filter((r) => {
    const key = r.address.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const found = unique.length > 0;

  return {
    source: connectorName,
    success: found,
    results: unique,
    evidence: unique.map((r, i) => ({
      type: 'address_record',
      label: `${r.address} (via ${r.source})`,
      confidence: i === 0 ? 'likely' : 'possible',
      data: r,
      sourceLabel: r.source,
      sourceUrl: `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(`${firstName} ${lastName}`)}&citystatezip=${encodeURIComponent(state)}`,
    })),
    errors: [],
    sourceResults: [tpsResult, fpsResult],
    addressCount: unique.length,
  };
}
