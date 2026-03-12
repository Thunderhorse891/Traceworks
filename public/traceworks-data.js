// Analyst console data model (replace with API-backed persistence).
// Package IDs must match api/_lib/packages.js exactly.
export const graph = {
  cases: [
    {
      id: 'TW-26031-A4K9',
      packageId: 'comprehensive',
      subject: 'Jordan R. Mercer',
      county: 'Harris',
      state: 'TX',
      payment: 'paid',
      workflow: 'processing',
      confidence: 'likely',
      sourcesTotal: 6,
      sourcesFound: 4,
      sourcesUnavailable: 1,
      partialReasons: ['Harris County deed index unavailable'],
    },
    {
      id: 'TW-26030-B7M2',
      packageId: 'ownership_encumbrance',
      subject: 'Mercer Holdings LLC',
      county: 'Harris',
      state: 'TX',
      payment: 'paid',
      workflow: 'analyst_review',
      confidence: 'confirmed',
      sourcesTotal: 5,
      sourcesFound: 5,
      sourcesUnavailable: 0,
      partialReasons: [],
    },
  ],
  relationships: [
    { type: 'OWNS', from: 'person:jordan-mercer', to: 'property:100-main', confidence: 'likely', source: 'hcad' },
    { type: 'REGISTERED_AT', from: 'business:mercer-holdings-llc', to: 'address:321-bayou', confidence: 'confirmed', source: 'tx-sos' },
    { type: 'RELATED_TO', from: 'person:jordan-mercer', to: 'probate:pc-2024-991', confidence: 'possible', source: 'tx-courts' },
  ],
};

// Package definitions — must match api/_lib/packages.js IDs and amounts
export const workflowDefinitions = [
  { id: 'standard',              name: 'Skip Trace & Locate',          amount: 9900,  deliveryHours: 24,  steps: 5,  sla: 'Same day' },
  { id: 'ownership_encumbrance', name: 'Property & Title Research',     amount: 24900, deliveryHours: 48,  steps: 7,  sla: 'Same day–24h' },
  { id: 'probate_heirship',      name: 'Heir & Beneficiary Locate',     amount: 32500, deliveryHours: 72,  steps: 9,  sla: '24h' },
  { id: 'asset_network',         name: 'Asset Network',                 amount: 39900, deliveryHours: 72,  steps: 11, sla: '24h–48h' },
  { id: 'comprehensive',         name: 'Comprehensive Locate + Assets', amount: 54900, deliveryHours: 96,  steps: 14, sla: '24h–48h' },
];

export const sourceRegistry = [
  { id: 'county-cad',    category: 'appraisal_district',  health: 'healthy',  freshness: '4h',  coverage: 'Harris / Travis / Bexar / Tarrant / Dallas' },
  { id: 'tx-sos',        category: 'corporate_registry',  health: 'healthy',  freshness: '6h',  coverage: 'Texas statewide' },
  { id: 'tx-courts',     category: 'court_dockets',       health: 'healthy',  freshness: '2h',  coverage: 'County + district courts' },
  { id: 'deed-index',    category: 'deed_instruments',    health: 'degraded', freshness: 'N/A', coverage: 'Requires browser auth per county' },
  { id: 'people-search', category: 'public_people_data',  health: 'healthy',  freshness: '12h', coverage: 'National (TruePeopleSearch / FastPeopleSearch)' },
  { id: 'obit-index',    category: 'obituary_index',      health: 'healthy',  freshness: '24h', coverage: 'Legacy.com / Tributes.com' },
];
