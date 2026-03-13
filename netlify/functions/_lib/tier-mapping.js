/**
 * Maps package IDs to internal workflow tier constants.
 *
 * ACTIVE IDs (in packages.js, accepted by create-checkout):
 *   locate, comprehensive, title, heir, custom
 *
 * LEGACY IDs (NOT in packages.js, create-checkout rejects them):
 *   standard, ownership_encumbrance, probate_heirship, asset_network
 *   Kept here only for backward-compatible webhook processing of old orders.
 *   Do not use these IDs in any new code path.
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
  // ── Active product IDs ─────────────────────────────────────────────
  locate:        REPORT_TIER.STANDARD_REPORT,
  comprehensive: REPORT_TIER.COMPREHENSIVE_REPORT,
  title:         REPORT_TIER.TITLE_PROPERTY_REPORT,
  heir:          REPORT_TIER.HEIR_LOCATION_REPORT,
  custom:        REPORT_TIER.CUSTOM,

  // ── Legacy IDs — webhook backward compat only ──────────────────────
  // These IDs were used before the locate/title/heir rename. They cannot
  // create new checkouts (getPackage returns null for them) but may appear
  // in webhook metadata for orders placed before the migration.
  standard:              REPORT_TIER.STANDARD_REPORT,
  ownership_encumbrance: REPORT_TIER.TITLE_PROPERTY_REPORT,
  probate_heirship:      REPORT_TIER.HEIR_LOCATION_REPORT,
  asset_network:         REPORT_TIER.ASSET_NETWORK_REPORT,
};

export function resolvePurchasedTier({ packageId, stripePriceId, stripeProductId } = {}) {
  if (packageId && PACKAGE_TO_TIER[packageId]) return PACKAGE_TO_TIER[packageId];

  // Fallback: infer from Stripe price/product label (for payment-link webhooks
  // where metadata.packageId is not set).
  const label = String(stripePriceId || stripeProductId || '').toLowerCase();
  if (label.includes('locate') || label.includes('standard'))                     return REPORT_TIER.STANDARD_REPORT;
  if (label.includes('title') || label.includes('ownership') || label.includes('encumbrance')) return REPORT_TIER.TITLE_PROPERTY_REPORT;
  if (label.includes('heir') || label.includes('probate'))                         return REPORT_TIER.HEIR_LOCATION_REPORT;
  if (label.includes('asset') || label.includes('network'))                        return REPORT_TIER.ASSET_NETWORK_REPORT;
  if (label.includes('comprehensive'))                                              return REPORT_TIER.COMPREHENSIVE_REPORT;

  throw new Error(`Unable to map purchased tier: packageId=${packageId}, stripePriceId=${stripePriceId}, stripeProductId=${stripeProductId}`);
}
