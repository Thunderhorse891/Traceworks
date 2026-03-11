/**
 * Connector: entity-search
 * Searches TX Secretary of State / Comptroller for business entity registrations.
 * Uses entityOwnerDetector to determine if subject is an entity before querying.
 */

import { entityOwnerDetector, txSOSScraper } from '../source-modules.js';

export const connectorName = 'entity-search';
export const description = 'Searches Texas Secretary of State and Comptroller databases for registered business entities — LLCs, corporations, partnerships, trusts.';
export const inputSchema = {
  required: ['entityName'],
  optional: ['fetchImpl'],
};
export const rateLimit = { maxPerMinute: 20, concurrency: 2 };

export async function runConnector({ entityName, fetchImpl = fetch }) {
  const detection = entityOwnerDetector(entityName);

  // If not detected as an entity, skip the SOS query and report it
  if (!detection.isEntity) {
    return {
      source: connectorName,
      success: false,
      results: [],
      evidence: [],
      errors: [],
      skippedReason: `"${entityName}" classified as individual — not a registrable business entity`,
      detection,
    };
  }

  const sosResult = await txSOSScraper(detection.normalizedName, fetchImpl);
  const entities = sosResult.status === 'found' ? (sosResult.data?.entities || []) : [];
  const found = entities.length > 0;

  return {
    source: connectorName,
    success: found,
    results: entities,
    evidence: entities.map((e) => ({
      type: 'entity_registration',
      label: `${e.entityName} — ${e.entityType} (${e.status})`,
      confidence: sosResult.confidence,
      data: e,
      sourceLabel: sosResult.sourceLabel,
      sourceUrl: sosResult.sourceUrl,
    })),
    errors: sosResult.status === 'error' ? [sosResult.errorDetail] : [],
    detection,
    sourceResult: sosResult,
  };
}
