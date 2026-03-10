/**
 * TraceWorks product tiers.
 * stripeKey values must match the Price IDs you create in your Stripe Dashboard.
 * Update the payLink values in public/packages.js after creating Stripe Payment Links.
 */

// Maps Stripe Price IDs → internal tier IDs (set these in your Stripe Dashboard)
export const TIER_MAP = {
  price_standard:              'standard',
  price_ownership_encumbrance: 'ownership_encumbrance',
  price_probate_heirship:      'probate_heirship',
  price_asset_network:         'asset_network',
  price_comprehensive:         'comprehensive',
  price_custom:                'custom',
};

export const PACKAGES = {
  standard: {
    id: 'standard',
    name: 'Standard Property Snapshot',
    amount: 9900,           // $99.00 in cents
    currency: 'usd',
    stripeKey: 'price_standard',
    deliveryHours: 24,
    workflowSteps: [1, 2, 7],
    sections: [
      'Property Identification',
      'Ownership Snapshot',
      'Value & Tax Summary',
    ],
  },
  ownership_encumbrance: {
    id: 'ownership_encumbrance',
    name: 'Ownership & Encumbrance Intelligence Report',
    amount: 24900,          // $249.00
    currency: 'usd',
    stripeKey: 'price_ownership_encumbrance',
    deliveryHours: 48,
    workflowSteps: [1, 2, 3, 7],
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
    name: 'Probate & Heirship Investigation Report',
    amount: 32500,          // $325.00
    currency: 'usd',
    stripeKey: 'price_probate_heirship',
    deliveryHours: 72,
    workflowSteps: [1, 2, 4, 5, 7],
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
    name: 'Asset & Property Network Report',
    amount: 39900,          // $399.00
    currency: 'usd',
    stripeKey: 'price_asset_network',
    deliveryHours: 72,
    workflowSteps: [1, 2, 3, 6, 7],
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
    amount: 54900,          // $549.00
    currency: 'usd',
    stripeKey: 'price_comprehensive',
    deliveryHours: 96,
    workflowSteps: [1, 2, 3, 4, 5, 6, 7],
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
    amount: 0,              // Billed hourly — discussed with client
    currency: 'usd',
    stripeKey: 'price_custom',
    deliveryHours: null,
    workflowSteps: [],
    sections: [],
  },
};

export function getPackage(packageId) {
  return PACKAGES[packageId] ?? null;
}

export function getTierFromStripeKey(stripeKey) {
  return TIER_MAP[stripeKey] ?? null;
}
