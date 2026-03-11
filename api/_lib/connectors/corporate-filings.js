/**
 * Connector: corporate-filings
 * Searches for corporate filing records, registered agents, and officer disclosures.
 * Uses TX SOS + supplemental DuckDuckGo search for filing artifacts.
 */

import { entityOwnerDetector, txSOSScraper, duckDuckGoSearch } from '../source-modules.js';

export const connectorName = 'corporate-filings';
export const description = 'Searches Texas SOS corporate filing records, registered agent disclosures, and officer/director filings for business entities.';
export const inputSchema = {
  required: ['entityName'],
  optional: ['state', 'fetchImpl'],
};
export const rateLimit = { maxPerMinute: 15, concurrency: 2 };

export async function runConnector({ entityName, state = 'TX', fetchImpl = fetch }) {
  const detection = entityOwnerDetector(entityName);

  const [sosResult, ddgResult] = await Promise.all([
    detection.isEntity
      ? txSOSScraper(detection.normalizedName, fetchImpl)
      : Promise.resolve(null),
    duckDuckGoSearch(
      `"${entityName}" corporate filing registered agent ${state} annual report`,
      fetchImpl
    ),
  ]);

  const entities = sosResult?.status === 'found' ? (sosResult.data?.entities || []) : [];
  const filingSignals = ddgResult?.status === 'found' ? (ddgResult.data?.results || []) : [];

  const allResults = [...entities, ...filingSignals];
  const found = allResults.length > 0;

  const evidence = [
    ...entities.map((e) => ({
      type: 'corporate_registration',
      label: `${e.entityName} — ${e.entityType} (${e.status})`,
      confidence: 'likely',
      data: e,
      sourceLabel: 'TX Secretary of State',
      sourceUrl: sosResult?.sourceUrl || 'https://mycpa.cpa.state.tx.us/coa/',
    })),
    ...filingSignals.map((r) => ({
      type: 'corporate_filing_signal',
      label: r.title,
      confidence: 'possible',
      data: r,
      sourceLabel: 'DuckDuckGo Filing Signal',
      sourceUrl: r.url,
    })),
  ];

  return {
    source: connectorName,
    success: found,
    results: allResults,
    evidence,
    errors: sosResult?.status === 'error' ? [sosResult.errorDetail] : [],
    detection,
    sourceResults: [sosResult, ddgResult].filter(Boolean),
  };
}
