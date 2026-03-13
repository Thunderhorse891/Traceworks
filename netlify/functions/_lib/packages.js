// Canonical package definitions — single source of truth.
// IDs must match public/packages.js clientPackages, tier-mapping.js,
// and the Stripe product/price IDs configured in the Stripe Dashboard.
export const PACKAGES = {
  standard: {
    id: 'standard',
    name: 'Standard Property Snapshot',
    amount: 9900,
    currency: 'usd',
    deliveryHours: 24,
    sections: [
      'County Appraisal District Lookup',
      'Tax Collector / Assessment Record',
      'Parcel GIS Lookup'
    ]
  },
  ownership_encumbrance: {
    id: 'ownership_encumbrance',
    name: 'Ownership & Encumbrance Intelligence Report',
    amount: 24900,
    currency: 'usd',
    deliveryHours: 48,
    sections: [
      'County Appraisal District Lookup',
      'County Clerk Deed Index',
      'Grantor-Grantee Index',
      'Mortgage / Trust Deed Index',
      'Chain-of-Title Continuity Analysis'
    ]
  },
  probate_heirship: {
    id: 'probate_heirship',
    name: 'Probate & Heirship Investigation Report',
    amount: 32500,
    currency: 'usd',
    deliveryHours: 72,
    sections: [
      'Obituary Index',
      'Probate Case Index',
      'Licensed People Association Lookup',
      'Heir Candidate Scoring'
    ]
  },
  asset_network: {
    id: 'asset_network',
    name: 'Asset & Property Network Report',
    amount: 39900,
    currency: 'usd',
    deliveryHours: 72,
    sections: [
      'County Appraisal District Lookup',
      'Tax Collector / Assessment Record',
      'Parcel GIS Lookup',
      'County Clerk Deed Index',
      'Grantor-Grantee Index',
      'Chain-of-Title Continuity Analysis'
    ]
  },
  comprehensive: {
    id: 'comprehensive',
    name: 'Comprehensive Investigative Report',
    amount: 54900,
    currency: 'usd',
    deliveryHours: 96,
    sections: [
      'County Appraisal District Lookup',
      'Tax Collector / Assessment Record',
      'Parcel GIS Lookup',
      'County Clerk Deed Index',
      'Grantor-Grantee Index',
      'Mortgage / Trust Deed Index',
      'Chain-of-Title Continuity Analysis',
      'Obituary Index',
      'Probate Case Index',
      'Licensed People Association Lookup',
      'Heir Candidate Scoring',
      'Cross-Source Discrepancy Analysis',
      'Confidence Matrix',
      'Recommended Next Steps'
    ]
  }
};

export function getPackage(packageId) {
  return PACKAGES[packageId] ?? null;
}

export const VALID_PACKAGE_IDS = Object.keys(PACKAGES);
