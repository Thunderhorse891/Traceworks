export const REPORT_TIER = {
  STANDARD_REPORT: 'STANDARD_REPORT',
  OWNERSHIP_ENCUMBRANCE_REPORT: 'OWNERSHIP_ENCUMBRANCE_REPORT',
  PROBATE_HEIRSHIP_REPORT: 'PROBATE_HEIRSHIP_REPORT',
  ASSET_NETWORK_REPORT: 'ASSET_NETWORK_REPORT',
  COMPREHENSIVE_REPORT: 'COMPREHENSIVE_REPORT'
};

// Maps canonical package IDs (from packages.js) to internal tier enum values.
const PACKAGE_TO_TIER = {
  standard: REPORT_TIER.STANDARD_REPORT,
  ownership_encumbrance: REPORT_TIER.OWNERSHIP_ENCUMBRANCE_REPORT,
  probate_heirship: REPORT_TIER.PROBATE_HEIRSHIP_REPORT,
  asset_network: REPORT_TIER.ASSET_NETWORK_REPORT,
  comprehensive: REPORT_TIER.COMPREHENSIVE_REPORT
};

// Maps Stripe price IDs — update these when products are created in the Stripe Dashboard.
const PRICE_TO_TIER = {
  price_standard: REPORT_TIER.STANDARD_REPORT,
  price_ownership_encumbrance: REPORT_TIER.OWNERSHIP_ENCUMBRANCE_REPORT,
  price_probate_heirship: REPORT_TIER.PROBATE_HEIRSHIP_REPORT,
  price_asset_network: REPORT_TIER.ASSET_NETWORK_REPORT,
  price_comprehensive: REPORT_TIER.COMPREHENSIVE_REPORT
};

export function resolvePurchasedTier({ packageId, stripePriceId, stripeProductId }) {
  if (packageId && PACKAGE_TO_TIER[packageId]) return PACKAGE_TO_TIER[packageId];
  if (stripePriceId && PRICE_TO_TIER[stripePriceId]) return PRICE_TO_TIER[stripePriceId];

  const byProduct = String(stripeProductId || '').toLowerCase();
  if (byProduct.includes('comprehensive')) return REPORT_TIER.COMPREHENSIVE_REPORT;
  if (byProduct.includes('asset_network') || byProduct.includes('asset network')) return REPORT_TIER.ASSET_NETWORK_REPORT;
  if (byProduct.includes('probate') || byProduct.includes('heirship') || byProduct.includes('heir')) return REPORT_TIER.PROBATE_HEIRSHIP_REPORT;
  if (byProduct.includes('ownership') || byProduct.includes('encumbrance') || byProduct.includes('title')) return REPORT_TIER.OWNERSHIP_ENCUMBRANCE_REPORT;
  if (byProduct.includes('standard')) return REPORT_TIER.STANDARD_REPORT;

  throw new Error(`Unable to map purchased tier from Stripe metadata/line-items. packageId=${packageId} stripePriceId=${stripePriceId}`);
}
