/**
 * Maps canonical package IDs to internal workflow tier constants.
 * Package IDs are defined in packages.js — do not hard-code them elsewhere.
 */

export const REPORT_TIER = {
  STANDARD_REPORT:       'STANDARD_REPORT',
  TITLE_PROPERTY_REPORT: 'TITLE_PROPERTY_REPORT',
  HEIR_LOCATION_REPORT:  'HEIR_LOCATION_REPORT',
  ASSET_NETWORK_REPORT:  'ASSET_NETWORK_REPORT',
  COMPREHENSIVE_REPORT:  'COMPREHENSIVE_REPORT',
  CUSTOM:                'CUSTOM',
};

const PACKAGE_TO_TIER = {
  // Canonical backend package IDs (used by create-checkout API)
  standard:              REPORT_TIER.STANDARD_REPORT,
  ownership_encumbrance: REPORT_TIER.TITLE_PROPERTY_REPORT,
  probate_heirship:      REPORT_TIER.HEIR_LOCATION_REPORT,
  asset_network:         REPORT_TIER.ASSET_NETWORK_REPORT,
  comprehensive:         REPORT_TIER.COMPREHENSIVE_REPORT,
  custom:                REPORT_TIER.CUSTOM,
  // Frontend payment-link package IDs — must stay in sync with public/packages.js
  locate:                REPORT_TIER.STANDARD_REPORT,
  title:                 REPORT_TIER.TITLE_PROPERTY_REPORT,
  heir:                  REPORT_TIER.HEIR_LOCATION_REPORT,
};

export function resolvePurchasedTier({ packageId, stripePriceId, stripeProductId } = {}) {
  if (packageId && PACKAGE_TO_TIER[packageId]) return PACKAGE_TO_TIER[packageId];

  // Fallback: infer from Stripe metadata labels (for webhook path)
  const label = String(stripePriceId || stripeProductId || '').toLowerCase();
  if (label.includes('standard'))                                        return REPORT_TIER.STANDARD_REPORT;
  if (label.includes('ownership') || label.includes('encumbrance') || label.includes('title')) return REPORT_TIER.TITLE_PROPERTY_REPORT;
  if (label.includes('probate') || label.includes('heir'))               return REPORT_TIER.HEIR_LOCATION_REPORT;
  if (label.includes('asset') || label.includes('network'))             return REPORT_TIER.ASSET_NETWORK_REPORT;
  if (label.includes('comprehensive'))                                   return REPORT_TIER.COMPREHENSIVE_REPORT;

  throw new Error(`Unable to map purchased tier: packageId=${packageId}, stripePriceId=${stripePriceId}, stripeProductId=${stripeProductId}`);
}
