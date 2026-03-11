export const REPORT_TIER = {
  STANDARD_REPORT: 'STANDARD_REPORT',
  TITLE_PROPERTY_REPORT: 'TITLE_PROPERTY_REPORT',
  HEIR_LOCATION_REPORT: 'HEIR_LOCATION_REPORT',
  COMPREHENSIVE_REPORT: 'COMPREHENSIVE_REPORT'
};

const PACKAGE_TO_TIER = {
  locate: REPORT_TIER.STANDARD_REPORT,
  title: REPORT_TIER.TITLE_PROPERTY_REPORT,
  heir: REPORT_TIER.HEIR_LOCATION_REPORT,
  comprehensive: REPORT_TIER.COMPREHENSIVE_REPORT
};

const PRICE_TO_TIER = {
  'price_standard_report': REPORT_TIER.STANDARD_REPORT,
  'price_title_property_report': REPORT_TIER.TITLE_PROPERTY_REPORT,
  'price_heir_location_report': REPORT_TIER.HEIR_LOCATION_REPORT,
  'price_comprehensive_report': REPORT_TIER.COMPREHENSIVE_REPORT
};

export function resolvePurchasedTier({ packageId, stripePriceId, stripeProductId }) {
  if (packageId && PACKAGE_TO_TIER[packageId]) return PACKAGE_TO_TIER[packageId];
  if (stripePriceId && PRICE_TO_TIER[stripePriceId]) return PRICE_TO_TIER[stripePriceId];

  const byProduct = String(stripeProductId || '').toLowerCase();
  if (byProduct.includes('standard')) return REPORT_TIER.STANDARD_REPORT;
  if (byProduct.includes('title')) return REPORT_TIER.TITLE_PROPERTY_REPORT;
  if (byProduct.includes('heir')) return REPORT_TIER.HEIR_LOCATION_REPORT;
  if (byProduct.includes('comprehensive')) return REPORT_TIER.COMPREHENSIVE_REPORT;

  throw new Error('Unable to map purchased tier from Stripe metadata/line-items.');
}
