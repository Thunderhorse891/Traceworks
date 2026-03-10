// Pay links: replace REPLACE_* with your real Stripe Payment Links from the Dashboard.
// Tier IDs must match api/_lib/packages.js exactly.
export const clientPackages = [
  {
    id: 'standard',
    name: 'Standard Property Report',
    price: '$99',
    payLink: 'https://buy.stripe.com/REPLACE_standard',
    description: 'Property snapshot — county appraisal, tax status, ownership name, parcel data.',
    bullets: [
      'County appraisal district data',
      'Property tax status',
      'Ownership name & entity detection',
      'Parcel / GIS data where available',
      'Source trace panel with confidence labels'
    ]
  },
  {
    id: 'ownership_encumbrance',
    name: 'Ownership & Encumbrance Report',
    price: '$249',
    payLink: 'https://buy.stripe.com/REPLACE_ownership',
    description: 'Deed and lien intelligence — grantor-grantee index, deed of trust, title chain.',
    bullets: [
      'Everything in Standard',
      'Deed index research',
      'Grantor-grantee index search',
      'Mortgage / deed of trust index',
      'Encumbrance analysis notes'
    ]
  },
  {
    id: 'probate_heirship',
    name: 'Probate & Heirship Report',
    price: '$325',
    payLink: 'https://buy.stripe.com/REPLACE_probate',
    description: 'Probate case research and heir candidate identification.',
    bullets: [
      'Probate case index search',
      'Obituary and death indicator search',
      'Heir candidate scoring',
      'Estate research workflow',
      'Manual review guidance for probate records'
    ]
  },
  {
    id: 'asset_network',
    name: 'Asset Network Report',
    price: '$399',
    payLink: 'https://buy.stripe.com/REPLACE_asset',
    description: 'Entity registry and asset network mapping — LLC, LP, Trust, Corp.',
    bullets: [
      'TX Secretary of State entity search',
      'Entity ownership detection (LLC/Trust/Corp/LP)',
      'Cross-referenced property holdings',
      'People search for principals',
      'Entity health and status indicators'
    ]
  },
  {
    id: 'comprehensive',
    name: 'Comprehensive Investigative Report',
    price: '$549',
    payLink: 'https://buy.stripe.com/REPLACE_comprehensive',
    description: 'Full workflow — property, deed, probate, entity, heir, and asset network.',
    bullets: [
      'All workflows combined',
      'Cross-source discrepancy analysis',
      'Heir candidate identification',
      'Full entity and principal research',
      'Confidence-labeled source trace panel'
    ]
  },
  {
    id: 'custom',
    name: 'Custom Research',
    price: 'Hourly — Contact Us',
    payLink: null,
    description: 'Deep-dive manual investigation for complex cases. Contact us for scope and pricing.',
    bullets: [
      'Scoped to your specific case needs',
      'Multi-county and multi-state capable',
      'Attorney and firm retainer available',
      'Turnaround negotiated per case',
      'Submit enterprise form below for quote'
    ]
  }
];
