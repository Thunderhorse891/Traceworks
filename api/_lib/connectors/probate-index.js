/**
 * Connector: probate-index
 * Searches TX Courts Online and obituary indexes for probate, estate, and decedent records.
 */

import { txCourtsOnlineScraper, obituaryIndexScraper } from '../source-modules.js';

export const connectorName = 'probate-index';
export const description = 'Queries Texas Courts Online for probate and estate case filings, and obituary/death record indexes for decedent verification.';
export const inputSchema = {
  required: ['name', 'county'],
  optional: ['state', 'fetchImpl'],
};
export const rateLimit = { maxPerMinute: 15, concurrency: 2 };

export async function runConnector({ name, county, state = 'TX', fetchImpl = fetch }) {
  const [courtsResult, obituaryResult] = await Promise.all([
    txCourtsOnlineScraper(name, county, fetchImpl),
    obituaryIndexScraper(name, county, state, fetchImpl),
  ]);

  const obits = obituaryResult.status === 'found' ? (obituaryResult.data?.obituaries || []) : [];
  const found = obits.length > 0;

  return {
    source: connectorName,
    success: found,
    results: obits,
    evidence: obits.map((o) => ({
      type: 'probate_death_signal',
      label: o.title,
      confidence: 'possible',
      data: o,
      sourceLabel: 'Obituary / Death Record Index',
      sourceUrl: o.url,
    })),
    errors: [],
    sourceResults: [courtsResult, obituaryResult],
    manualReviewUrl: courtsResult.sourceUrl,
    manualReviewNote: courtsResult.errorDetail,
  };
}
