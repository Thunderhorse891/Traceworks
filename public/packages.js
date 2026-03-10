export const clientPackages = [
  {
    id: 'locate',
    name: 'Skip Trace & Locate',
    price: '$75',
    bestFor: 'Fast service attempts and urgent contact verification',
    turnaround: 'Typical delivery: same day',
    payLink: 'https://buy.stripe.com/8x2aEXgLPbEKcxke4lenS01',
    bullets: ['Current address verification', 'Phone number lookup', 'Public records cross-reference', 'PDF dossier via email'],
    reportPreviewPath: '/reports/report-locate.html',
    summary:
      'Fast, legal-use locate package for service attempts, collections, and case support when you need a defensible starting dossier.',
    previewIncludes: [
      'Identity snapshot with known aliases and baseline signals',
      'Address probability grid with confidence notes',
      'Contact surface map and follow-up actions for next 48 hours'
    ]
  },
  {
    id: 'comprehensive',
    name: 'Comprehensive Locate + Assets',
    price: '$150',
    featured: true,
    bestFor: 'Collections, enforcement, and deeper recovery strategy',
    turnaround: 'Typical delivery: same day to 24h',
    payLink: 'https://buy.stripe.com/14A9ATgLP6kqbtgaS9enS02',
    bullets: ['Everything in Skip Trace & Locate', 'Asset & property search', 'Employment verification attempt', 'Documented source citations'],
    reportPreviewPath: '/reports/report-comprehensive.html',
    summary:
      'Expanded package for legal teams that need locate plus asset and business context to improve enforcement and recovery strategy.',
    previewIncludes: [
      'Consolidated identity and contact intelligence matrix',
      'Asset and property exposure indicators with source references',
      'Employment/business link analysis and collection strategy recommendations'
    ]
  },
  {
    id: 'title',
    name: 'Property & Title Research',
    price: '$200',
    bestFor: 'Title disputes, due diligence, and curative planning',
    turnaround: 'Typical delivery: 24h',
    payLink: 'https://buy.stripe.com/9B628rgLP7ou2WK6BTenS03',
    bullets: ['Deed/index intelligence summary', 'Lien & encumbrance indicators', 'Quitclaim/deed filing signal review', 'County filing summary (not title opinion)'],
    reportPreviewPath: '/reports/report-title.html',
    summary:
      'Title-focused intelligence for property disputes, acquisition due diligence, and curative legal planning.',
    previewIncludes: [
      'Ownership trail in who/what/when/how/why format',
      'Lien and encumbrance risk summary',
      'Title curative action checklist and filing priorities'
    ]
  },
  {
    id: 'heir',
    name: 'Heir & Beneficiary Locate',
    price: '$100',
    bestFor: 'Probate support and heir contact sequencing',
    turnaround: 'Typical delivery: same day to 24h',
    payLink: 'https://buy.stripe.com/aFadR953724a9l8aS9enS04',
    bullets: ['Probate and estate index support', 'Heir-candidate research (not adjudication)', 'Contactability risk notes', 'Court-workflow summary'],
    reportPreviewPath: '/reports/report-heir.html',
    summary:
      'Probate support package to identify likely heirs/beneficiaries and prioritize lawful verification workflow for court preparation.',
    previewIncludes: [
      'Heir candidate matrix and relationship confidence',
      'Probate filing signals and docket-oriented next steps',
      'Contactability ranking with verification sequence'
    ]
  }
];
