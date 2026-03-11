/**
 * Connector: phone-association
 * Extracts phone number associations from public aggregator data.
 * Returns phone numbers with confidence ratings based on cross-source corroboration.
 */

import { truePeopleSearchScraper, fastPeopleSearchScraper } from '../source-modules.js';

export const connectorName = 'phone-association';
export const description = 'Extracts and cross-references phone number associations for individuals from public aggregator records — supports locate and contact workflows.';
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

  // Build phone → sources map for corroboration scoring
  const phoneMap = new Map();

  for (const [result, source] of [[tpsResult, 'TruePeopleSearch'], [fpsResult, 'FastPeopleSearch']]) {
    if (result.status !== 'found') continue;
    for (const person of (result.data?.people || [])) {
      for (const phone of (person.phones || [])) {
        const normalized = phone.replace(/\D/g, '');
        if (normalized.length !== 10) continue;
        if (!phoneMap.has(normalized)) {
          phoneMap.set(normalized, { phone, formatted: phone, sources: [], associatedNames: [] });
        }
        const entry = phoneMap.get(normalized);
        if (!entry.sources.includes(source)) entry.sources.push(source);
        if (person.name && !entry.associatedNames.includes(person.name)) {
          entry.associatedNames.push(person.name);
        }
      }
    }
  }

  const phones = Array.from(phoneMap.values());
  // Sort by corroboration (multi-source first)
  phones.sort((a, b) => b.sources.length - a.sources.length);

  const found = phones.length > 0;

  return {
    source: connectorName,
    success: found,
    results: phones,
    evidence: phones.map((p) => ({
      type: 'phone_association',
      label: `${p.formatted} — ${p.sources.join(' + ')}`,
      confidence: p.sources.length >= 2 ? 'likely' : 'possible',
      data: p,
      sourceLabel: p.sources.join(' / '),
      sourceUrl: `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(`${firstName} ${lastName}`)}&citystatezip=${encodeURIComponent(state)}`,
      corroborated: p.sources.length >= 2,
    })),
    errors: [],
    sourceResults: [tpsResult, fpsResult],
    phoneCount: phones.length,
    corroboratedCount: phones.filter((p) => p.sources.length >= 2).length,
  };
}
