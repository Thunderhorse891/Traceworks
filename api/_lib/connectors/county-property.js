/**
 * Connector: county-property
 * Queries Texas county CAD portals for property ownership, appraisal, and assessment data.
 * Wraps texasCADScraper from source-modules.js.
 */

import { texasCADScraper } from '../source-modules.js';

export const connectorName = 'county-property';
export const description = 'Searches Texas county appraisal district portals for property records, ownership data, assessed value, and parcel identification.';
export const inputSchema = {
  required: ['county', 'query'],
  optional: ['state', 'fetchImpl'],
};
export const rateLimit = { maxPerMinute: 30, concurrency: 3 };

export async function runConnector({ county, query, state = 'TX', fetchImpl = fetch }) {
  const sourceResult = await texasCADScraper(county, query, fetchImpl);

  const found = ['found', 'partial'].includes(sourceResult.status);
  const properties = found ? (sourceResult.data?.properties || []) : [];

  return {
    source: connectorName,
    success: found,
    results: properties,
    evidence: properties.map((p) => ({
      type: 'property_record',
      label: `${sourceResult.sourceLabel} — ${p.situsAddress || p.parcelId}`,
      confidence: sourceResult.confidence,
      data: p,
      sourceLabel: sourceResult.sourceLabel,
      sourceUrl: sourceResult.sourceUrl,
    })),
    errors: sourceResult.status === 'error' ? [sourceResult.errorDetail] : [],
    sourceResult,
  };
}
