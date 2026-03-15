// Frontend package definitions.
// IDs here MUST match netlify/functions/_lib/packages.js exactly.
export const clientPackages = [
  {
    id: 'standard',
    name: 'Standard Property Snapshot',
    price: '$99',
    deliveryHours: 24,
    bestFor: 'Quick property ownership lookup and parcel verification',
    turnaround: 'Typical delivery: same day',
    payLink: 'https://buy.stripe.com/8x2aEXgLPbEKcxke4lenS01',
    bullets: [
      'County appraisal district lookup',
      'Tax assessment / parcel record',
      'GIS parcel boundary lookup',
      'Source trace panel — every query logged'
    ],
    summary:
      'Fast public-record property snapshot for legal professionals needing ownership confirmation, parcel data, and assessment history.',
    includedFindings: [
      'County CAD owner of record with parcel ID and legal description',
      'Tax assessment status and last-known assessment value',
      'Parcel GIS result with any known address discrepancies'
    ],
    workflowScope: [
      'County property data',
      'Tax collector lookup',
      'Parcel GIS verification'
    ],
    intake: {
      defaultSubjectType: 'property',
      guidance:
        'Best results come from a property address or parcel ID. Owner name still helps when parcel data is incomplete.',
      requiredSignals: ['Subject or property name', 'County'],
      requiredGroups: [
        { label: 'Primary subject', anyOf: ['subjectName'] },
        { label: 'County', anyOf: ['county'] }
      ],
      recommendedSignals: ['Last known address', 'Parcel / APN ID', 'Profile or listing URL'],
      recommendedFields: ['lastKnownAddress', 'parcelId', 'websiteProfile'],
      fields: ['subjectType', 'subjectName', 'county', 'state', 'lastKnownAddress', 'parcelId', 'websiteProfile', 'requestedFindings']
    }
  },
  {
    id: 'ownership_encumbrance',
    name: 'Ownership & Encumbrance Intelligence Report',
    price: '$249',
    deliveryHours: 48,
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
    summary:
      'Deed and encumbrance intelligence for title due diligence, acquisition research, and curative planning. Not a title opinion.',
    includedFindings: [
      'Instrument history with volume/page references and recording dates',
      'Grantor-grantee index entries with party names',
      'Chain continuity assessment with any flagged gaps or conflicts'
    ],
    workflowScope: [
      'Property ownership confirmation',
      'Recorder index search',
      'Grantor-grantee chain review',
      'Mortgage / trust deed lookup'
    ],
    intake: {
      defaultSubjectType: 'property',
      guidance:
        'Use this when you need deed history or encumbrance signals. Address, parcel ID, and alternate owner names materially improve continuity checks.',
      requiredSignals: ['Subject or property name', 'County'],
      requiredGroups: [
        { label: 'Primary subject', anyOf: ['subjectName'] },
        { label: 'County', anyOf: ['county'] }
      ],
      recommendedSignals: ['Last known address', 'Parcel / APN ID', 'Alternate owner / entity names'],
      recommendedFields: ['lastKnownAddress', 'parcelId', 'alternateNames', 'websiteProfile'],
      fields: ['subjectType', 'subjectName', 'county', 'state', 'lastKnownAddress', 'parcelId', 'alternateNames', 'websiteProfile', 'requestedFindings']
    }
  },
  {
    id: 'probate_heirship',
    name: 'Probate & Heirship Investigation Report',
    price: '$325',
    deliveryHours: 72,
    bestFor: 'Heir locate, probate support, and beneficiary identification',
    turnaround: 'Typical delivery: 24h',
    payLink: 'https://buy.stripe.com/9B628rgLP7ou2WK6BTenS03',
    bullets: [
      'Obituary index cross-reference',
      'Probate case index lookup',
      'Licensed people association data (if configured)',
      'Heir candidate scoring — probable / possible / low-confidence'
    ],
    summary:
      'Heir and beneficiary investigation for probate support, estate administration, and court-workflow preparation. Not a legal heirship adjudication.',
    includedFindings: [
      'Obituary cross-reference with death year and location signals',
      'Probate case index result with case number and status if found',
      'Heir candidate matrix with confidence labels and contact leads'
    ],
    workflowScope: [
      'Decedent obituary sweep',
      'Probate case index lookup',
      'People association search',
      'Heir confidence scoring'
    ],
    intake: {
      defaultSubjectType: 'estate',
      guidance:
        'For probate matters, decedent name plus one extra identifier like death year, date of birth, address, or relative alias improves match quality and reduces false positives.',
      requiredSignals: ['Decedent name', 'County', 'One secondary identifier'],
      requiredGroups: [
        { label: 'Decedent name', anyOf: ['subjectName'] },
        { label: 'County', anyOf: ['county'] },
        { label: 'Secondary identifier', anyOf: ['deathYear', 'dateOfBirth', 'lastKnownAddress', 'alternateNames', 'subjectPhone', 'subjectEmail'] }
      ],
      recommendedSignals: ['Death year', 'Date of birth', 'Last known address', 'Aliases / relative names'],
      recommendedFields: ['deathYear', 'dateOfBirth', 'lastKnownAddress', 'alternateNames', 'subjectPhone', 'subjectEmail'],
      fields: ['subjectType', 'subjectName', 'county', 'state', 'lastKnownAddress', 'alternateNames', 'dateOfBirth', 'deathYear', 'subjectPhone', 'subjectEmail', 'requestedFindings']
    }
  },
  {
    id: 'asset_network',
    name: 'Asset & Property Network Report',
    price: '$399',
    deliveryHours: 72,
    bestFor: 'Asset tracing, enforcement strategy, and collections support',
    turnaround: 'Typical delivery: 24h to 48h',
    payLink: 'https://buy.stripe.com/aFadR953724a9l8aS9enS04',
    bullets: [
      'CAD + tax + GIS parcel network lookup',
      'Deed index and grantor-grantee cross-reference',
      'Chain-of-title analysis across found parcels',
      'Source trace panel — all instruments and queries logged'
    ],
    summary:
      'Extended property and asset network research for enforcement, collections, and recovery strategy. Combines property snapshot with deed and encumbrance intelligence.',
    includedFindings: [
      'Multi-parcel ownership network from CAD and GIS sources',
      'Deed and grantor-grantee cross-reference for known parcels',
      'Chain continuity flags and documented source limitations'
    ],
    workflowScope: [
      'Property discovery',
      'Recorder cross-reference',
      'Portfolio expansion by owner / entity',
      'Chain continuity review'
    ],
    intake: {
      defaultSubjectType: 'entity',
      guidance:
        'This tier performs best when you provide the primary owner or entity plus any known parcel, address, alias, or business registration trail.',
      requiredSignals: ['Subject name or entity', 'County'],
      requiredGroups: [
        { label: 'Primary subject or entity', anyOf: ['subjectName'] },
        { label: 'County', anyOf: ['county'] }
      ],
      recommendedSignals: ['Last known address', 'Parcel / APN ID', 'Alternate names', 'Profile or company URL'],
      recommendedFields: ['lastKnownAddress', 'parcelId', 'alternateNames', 'websiteProfile', 'subjectPhone', 'subjectEmail'],
      fields: ['subjectType', 'subjectName', 'county', 'state', 'lastKnownAddress', 'parcelId', 'alternateNames', 'websiteProfile', 'subjectPhone', 'subjectEmail', 'requestedFindings']
    }
  },
  {
    id: 'comprehensive',
    name: 'Comprehensive Investigative Report',
    price: '$549',
    deliveryHours: 96,
    bestFor: 'Full-scope legal investigation: property, deed, and heir research combined',
    turnaround: 'Typical delivery: 24h to 48h',
    payLink: 'https://buy.stripe.com/aFadR953724a9l8aS9enS04',
    bullets: [
      'All property snapshot + deed + heir modules combined',
      'Cross-source discrepancy analysis',
      'Confidence matrix across all findings',
      'Recommended next steps for legal workflow'
    ],
    summary:
      'Maximum-scope investigative report combining property, encumbrance, and heirship research into a single deliverable. For complex matters requiring full public-record coverage.',
    includedFindings: [
      'All property, deed, and heir sections with full source trace',
      'Cross-source conflict flags where owner data disagrees',
      'Confidence matrix and analyst-oriented next steps'
    ],
    workflowScope: [
      'Property + recorder + probate combined',
      'Cross-source discrepancy review',
      'Confidence matrix',
      'Next-step recommendations'
    ],
    intake: {
      defaultSubjectType: 'mixed',
      guidance:
        'Use comprehensive intake detail here. The engine will prioritize the strongest identifiers first, then expand outward across property, entity, and probate branches.',
      requiredSignals: ['Primary subject name', 'County'],
      requiredGroups: [
        { label: 'Primary subject', anyOf: ['subjectName'] },
        { label: 'County', anyOf: ['county'] }
      ],
      recommendedSignals: ['Address', 'Parcel / APN ID', 'Aliases', 'Date of birth or death year', 'Phone or email'],
      recommendedFields: ['lastKnownAddress', 'parcelId', 'alternateNames', 'dateOfBirth', 'deathYear', 'subjectPhone', 'subjectEmail', 'websiteProfile'],
      fields: ['subjectType', 'subjectName', 'county', 'state', 'lastKnownAddress', 'parcelId', 'alternateNames', 'dateOfBirth', 'deathYear', 'subjectPhone', 'subjectEmail', 'websiteProfile', 'requestedFindings']
    }
  }
];
