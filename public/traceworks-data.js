// Mock intelligence workspace data model (replace with API-backed graph persistence).
export const graph = {
  cases: [
    {
      id: 'TW-24019',
      package: 'full_intelligence',
      subject: 'Jordan Mercer',
      property: '100 Main St, Houston TX',
      payment: 'paid',
      workflow: 'running',
      confidence: 'medium',
      entities: 14,
      sources: 23,
      redFlags: 2,
      evidenceCompleteness: 0.79,
    },
    {
      id: 'TW-24018',
      package: 'ownership_liens',
      subject: 'Mercer Holdings LLC',
      property: '321 Bayou Rd, Harris TX',
      payment: 'paid',
      workflow: 'analyst_review',
      confidence: 'high',
      entities: 10,
      sources: 17,
      redFlags: 1,
      evidenceCompleteness: 0.93,
    },
  ],
  relationships: [
    { type: 'OWNS', from: 'person:jordan-mercer', to: 'property:100-main', confidence: 'likely', source: 'county-deeds' },
    { type: 'REGISTERED_AT', from: 'business:mercer-holdings-llc', to: 'address:321-bayou', confidence: 'confirmed', source: 'tx-sos' },
    { type: 'RELATED_TO', from: 'person:jordan-mercer', to: 'probate:pc-2024-991', confidence: 'possible', source: 'probate-index' },
  ],
};

export const workflowDefinitions = [
  { id: 'title_snapshot', package: '$29 Title Snapshot', steps: 7, sla: 'same day' },
  { id: 'ownership_liens', package: '$79 Ownership + Liens', steps: 10, sla: 'same day–24h' },
  { id: 'heir_search', package: '$149 Heir Search', steps: 11, sla: '24h' },
  { id: 'full_intelligence', package: '$299 Full Intelligence Report', steps: 16, sla: '24h–48h' },
];

export const sourceRegistry = [
  { id: 'county-deeds', category: 'deed_indexes', health: 'healthy', freshness: '6h', coverage: 'Harris/Travis/Bexar/Tarrant' },
  { id: 'probate-index', category: 'probate_filings', health: 'degraded', freshness: '18h', coverage: 'TX counties' },
  { id: 'tx-sos', category: 'corporate_registry', health: 'healthy', freshness: '4h', coverage: 'Texas SOS' },
  { id: 'court-dockets', category: 'court_dockets', health: 'healthy', freshness: '2h', coverage: 'county + district' },
];
