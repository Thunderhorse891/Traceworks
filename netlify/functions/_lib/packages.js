/**
 * TraceWorks — Canonical Package Model
 *
 * Single source of truth for all product tiers. Every surface that references
 * a package ID, price, name, or workflow tier MUST import from this file.
 *
 * Stripe pricing: implemented as price_data (dynamic) in create-checkout.js —
 * no separate Stripe Price objects required. Set STRIPE_SECRET_KEY only.
 */

export const PACKAGES = {
  standard: {
    id: 'standard',
    name: 'Standard Property Snapshot',
    tagline: 'Ownership and assessed value — fast.',
    amount: 9900,
    currency: 'usd',
    deliveryHours: 24,
    sla: 'Same day',
    workflowTier: 'STANDARD_REPORT',
    sections: [
      'Property Identification',
      'Ownership Snapshot',
      'Value & Tax Summary',
    ],
  },
  ownership_encumbrance: {
    id: 'ownership_encumbrance',
    name: 'Ownership & Encumbrance Intelligence',
    tagline: 'Full deed chain, liens, and transaction timeline.',
    amount: 24900,
    currency: 'usd',
    deliveryHours: 48,
    sla: 'Same day – 24h',
    workflowTier: 'TITLE_PROPERTY_REPORT',
    sections: [
      'Full Property Identification',
      'Ownership Evidence & Deed Chain',
      'Encumbrance Signals',
      'Transaction Timeline',
      'Entity Findings (if applicable)',
    ],
  },
  probate_heirship: {
    id: 'probate_heirship',
    name: 'Probate & Heirship Investigation',
    tagline: 'Decedent search, heir candidates, contactability.',
    amount: 32500,
    currency: 'usd',
    deliveryHours: 72,
    sla: '24h',
    workflowTier: 'HEIR_LOCATION_REPORT',
    sections: [
      'Decedent Search Summary',
      'Property Connection',
      'Death & Probate Indicators',
      'Heir Candidate List',
      'Contactability Assessment',
    ],
  },
  asset_network: {
    id: 'asset_network',
    name: 'Asset & Property Network',
    tagline: 'Portfolio discovery, entity structure, geographic spread.',
    amount: 39900,
    currency: 'usd',
    deliveryHours: 72,
    sla: '24h – 48h',
    workflowTier: 'ASSET_NETWORK_REPORT',
    sections: [
      'Owner Normalization',
      'Property Portfolio Discovery',
      'Ownership Structure',
      'Entity Investigation',
      'Geographic Distribution',
    ],
  },
  comprehensive: {
    id: 'comprehensive',
    name: 'Comprehensive Investigative Report',
    tagline: 'Full-scope intelligence with cross-source discrepancy analysis.',
    amount: 54900,
    currency: 'usd',
    deliveryHours: 96,
    sla: '24h – 48h',
    workflowTier: 'COMPREHENSIVE_REPORT',
    sections: [
      'Executive Summary',
      'Full Property Snapshot',
      'Ownership & Encumbrance',
      'Probate & Heir Findings',
      'Asset Network',
      'Cross-Source Discrepancy Analysis',
      'Confidence Matrix',
      'Recommended Next Steps',
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

  // ── Frontend payment-link package IDs ──────────────────────────────
  // These match the IDs in public/packages.js and the Stripe Payment Links.
  // They map to the same workflow tiers as their canonical equivalents above.
  // Prices reflect what the Stripe Payment Links are configured to charge.
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
};

export const VALID_PACKAGE_IDS = new Set(Object.keys(PACKAGES));

export function getPackage(packageId) {
  return PACKAGES[packageId] ?? null;
}
