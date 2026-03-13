/**
 * TraceWorks — Canonical Package Model
 *
 * SINGLE SOURCE OF TRUTH for active product IDs, names, prices, and workflow
 * tier assignments. Every surface that references a package ID, price, name,
 * or workflow tier MUST import from this file.
 *
 * Active products (sold via app.js → /api/create-checkout and Stripe Payment Links):
 *   locate         $75    Standard Report
 *   comprehensive  $150   Comprehensive Report
 *   title          $200   Title/Property Report
 *   heir           $100   Heir Location Report
 *   custom         $0     Enterprise — scoped separately
 *
 * Pricing: enforced via price_data in create-checkout.js. The amounts here
 * MUST match what the corresponding Stripe Payment Links charge. Verify in
 * Stripe Dashboard → Payment Links before changing any amount.
 *
 * Legacy IDs (standard / ownership_encumbrance / probate_heirship /
 * asset_network) are intentionally absent from PACKAGES. They cannot be
 * used to create new checkouts. They remain in PACKAGE_TO_TIER in
 * tier-mapping.js for backward-compatible webhook processing of any orders
 * created before the ID migration.
 */

export const PACKAGES = {
  locate: {
    id: 'locate',
    name: 'Skip Trace & Locate',
    tagline: 'Current address, phones, and public-record cross-reference.',
    amount: 7500,
    currency: 'usd',
    deliveryHours: 24,
    sla: 'Same day',
    workflowTier: 'STANDARD_REPORT',
    sections: [
      'Subject Identity Snapshot',
      'Current Address Probability Grid',
      'Contact Surface and Phone Trails',
      'Service-of-Process Recommendations',
    ],
  },

  comprehensive: {
    id: 'comprehensive',
    name: 'Comprehensive Locate + Assets',
    tagline: 'Full-scope intelligence with cross-source discrepancy analysis.',
    amount: 15000,
    currency: 'usd',
    deliveryHours: 48,
    sla: 'Same day – 24h',
    workflowTier: 'COMPREHENSIVE_REPORT',
    sections: [
      'Subject Identity Snapshot',
      'Address + Contact Consolidation',
      'Asset and Property Exposure',
      'Employment / Business Link Analysis',
      'Collection Strategy Recommendations',
    ],
  },

  title: {
    id: 'title',
    name: 'Property & Title Research',
    tagline: 'Deed/index intelligence, lien signals, and curative planning.',
    amount: 20000,
    currency: 'usd',
    deliveryHours: 48,
    sla: 'Same day – 24h',
    workflowTier: 'TITLE_PROPERTY_REPORT',
    sections: [
      'Parcel/Subject Snapshot',
      'Ownership Trail — Who/What/When/Why/How',
      'Lien & Encumbrance Review',
      'Lease / Operator / Royalty Clarity',
      'Title Risk and Curative Actions',
    ],
  },

  heir: {
    id: 'heir',
    name: 'Heir & Beneficiary Locate',
    tagline: 'Probate support and heir contact sequencing.',
    amount: 10000,
    currency: 'usd',
    deliveryHours: 48,
    sla: 'Same day – 24h',
    workflowTier: 'HEIR_LOCATION_REPORT',
    sections: [
      'Decedent/Family Context Snapshot',
      'Heir Candidate Matrix',
      'Probate and Filing Signals',
      'Contactability & Verification Priority',
      'Court-Ready Next Actions',
    ],
  },

  custom: {
    id: 'custom',
    name: 'Custom Research',
    tagline: 'Hourly engagement — scoped with client.',
    amount: 0,
    currency: 'usd',
    deliveryHours: null,
    sla: 'Negotiated',
    workflowTier: 'CUSTOM',
    sections: [],
  },
};

export const VALID_PACKAGE_IDS = new Set(Object.keys(PACKAGES));

export function getPackage(packageId) {
  return PACKAGES[packageId] ?? null;
}
