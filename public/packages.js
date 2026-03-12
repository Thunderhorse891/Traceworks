// Frontend package definitions.
// IDs here MUST match netlify/functions/_lib/packages.js exactly.
// payLink values must be updated to live Stripe Payment Links from your Stripe Dashboard
// whenever prices change or new products are created.
export const clientPackages = [
  {
    id: 'standard',
    name: 'Standard Property Snapshot',
    price: '$99',
    bestFor: 'Quick property ownership lookup and parcel verification',
    turnaround: 'Typical delivery: same day',
    payLink: 'https://buy.stripe.com/8x2aEXgLPbEKcxke4lenS01',
    bullets: [
      'County appraisal district lookup',
      'Tax assessment / parcel record',
      'GIS parcel boundary lookup',
      'Source trace panel — every query logged'
    ],
    reportPreviewPath: '/reports/report-locate.html',
    summary:
      'Fast public-record property snapshot for legal professionals needing ownership confirmation, parcel data, and assessment history.',
    previewIncludes: [
      'County CAD owner of record with parcel ID and legal description',
      'Tax assessment status and last-known assessment value',
      'Parcel GIS result with any known address discrepancies'
    ]
  },
  {
    id: 'ownership_encumbrance',
    name: 'Ownership & Encumbrance Intelligence Report',
    price: '$249',
    featured: true,
    bestFor: 'Deed research, title due diligence, and lien identification',
    turnaround: 'Typical delivery: same day to 24h',
    payLink: 'https://buy.stripe.com/14A9ATgLP6kqbtgaS9enS02',
    bullets: [
      'County CAD + deed index + grantor-grantee records',
      'Mortgage and trust deed index',
      'Chain-of-title continuity analysis',
      'Source trace panel — every instrument logged'
    ],
    reportPreviewPath: '/reports/report-title.html',
    summary:
      'Deed and encumbrance intelligence for title due diligence, acquisition research, and curative planning. Not a title opinion.',
    previewIncludes: [
      'Instrument history with volume/page references and recording dates',
      'Grantor-grantee index entries with party names',
      'Chain continuity assessment with any flagged gaps or conflicts'
    ]
  },
  {
    id: 'probate_heirship',
    name: 'Probate & Heirship Investigation Report',
    price: '$325',
    bestFor: 'Heir locate, probate support, and beneficiary identification',
    turnaround: 'Typical delivery: 24h',
    payLink: 'https://buy.stripe.com/9B628rgLP7ou2WK6BTenS03',
    bullets: [
      'Obituary index cross-reference',
      'Probate case index lookup',
      'Licensed people association data (if configured)',
      'Heir candidate scoring — probable / possible / low-confidence'
    ],
    reportPreviewPath: '/reports/report-heir.html',
    summary:
      'Heir and beneficiary investigation for probate support, estate administration, and court-workflow preparation. Not a legal heirship adjudication.',
    previewIncludes: [
      'Obituary cross-reference with death year and location signals',
      'Probate case index result with case number and status if found',
      'Heir candidate matrix with confidence labels and contact leads'
    ]
  },
  {
    id: 'asset_network',
    name: 'Asset & Property Network Report',
    price: '$399',
    bestFor: 'Asset tracing, enforcement strategy, and collections support',
    turnaround: 'Typical delivery: 24h to 48h',
    payLink: 'https://buy.stripe.com/aFadR953724a9l8aS9enS04',
    bullets: [
      'CAD + tax + GIS parcel network lookup',
      'Deed index and grantor-grantee cross-reference',
      'Chain-of-title analysis across found parcels',
      'Source trace panel — all instruments and queries logged'
    ],
    reportPreviewPath: '/reports/report-comprehensive.html',
    summary:
      'Extended property and asset network research for enforcement, collections, and recovery strategy. Combines property snapshot with deed and encumbrance intelligence.',
    previewIncludes: [
      'Multi-parcel ownership network from CAD and GIS sources',
      'Deed and grantor-grantee cross-reference for known parcels',
      'Chain continuity flags and documented source limitations'
    ]
  },
  {
    id: 'comprehensive',
    name: 'Comprehensive Investigative Report',
    price: '$549',
    bestFor: 'Full-scope legal investigation: property, deed, and heir research combined',
    turnaround: 'Typical delivery: 24h to 48h',
    payLink: 'https://buy.stripe.com/aFadR953724a9l8aS9enS04',
    bullets: [
      'All property snapshot + deed + heir modules combined',
      'Cross-source discrepancy analysis',
      'Confidence matrix across all findings',
      'Recommended next steps for legal workflow'
    ],
    reportPreviewPath: '/reports/report-comprehensive.html',
    summary:
      'Maximum-scope investigative report combining property, encumbrance, and heirship research into a single deliverable. For complex matters requiring full public-record coverage.',
    previewIncludes: [
      'All property, deed, and heir sections with full source trace',
      'Cross-source conflict flags where owner data disagrees',
      'Confidence matrix and analyst-oriented next steps'
    ]
  }
];
