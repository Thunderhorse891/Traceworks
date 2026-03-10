import { gatherOsint } from './osint.js';
import { REPORT_TIER } from './tier-mapping.js';

const TIER_SOURCE_REQUIREMENTS = {
  [REPORT_TIER.STANDARD_REPORT]: ['ROBIN_API_URL'],
  [REPORT_TIER.TITLE_PROPERTY_REPORT]: ['ROBIN_API_URL'],
  [REPORT_TIER.HEIR_LOCATION_REPORT]: ['ROBIN_API_URL'],
  [REPORT_TIER.COMPREHENSIVE_REPORT]: ['ROBIN_API_URL']
};

function requireConfiguredSources(tier, env = process.env) {
  const strict = String(env.PAID_FULFILLMENT_STRICT || 'true').toLowerCase() !== 'false';
  if (!strict) return;
  const needed = TIER_SOURCE_REQUIREMENTS[tier] || [];
  const missing = needed.filter((k) => !String(env[k] || '').trim());
  if (missing.length) {
    throw new Error(`Missing required source configuration for ${tier}: ${missing.join(', ')}`);
  }
}

async function runTierSearch(order, packageId) {
  const query = `${order.subjectName || ''} ${order.website || ''} ${order.goals || ''}`.trim();
  if (!query) throw new Error('Cannot run OSINT workflow: order has no searchable input criteria.');
  return gatherOsint(query, { packageId, env: process.env });
}

export async function runStandardReport(order) {
  requireConfiguredSources(REPORT_TIER.STANDARD_REPORT);
  return runTierSearch(order, 'locate');
}

export async function runTitlePropertyReport(order) {
  requireConfiguredSources(REPORT_TIER.TITLE_PROPERTY_REPORT);
  return runTierSearch(order, 'title');
}

export async function runHeirLocationReport(order) {
  requireConfiguredSources(REPORT_TIER.HEIR_LOCATION_REPORT);
  return runTierSearch(order, 'heir');
}

export async function runComprehensiveReport(order) {
  requireConfiguredSources(REPORT_TIER.COMPREHENSIVE_REPORT);
  return runTierSearch(order, 'comprehensive');
}
