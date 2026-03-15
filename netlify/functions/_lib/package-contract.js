export const LEGACY_PACKAGE_ALIASES = Object.freeze({
  locate: 'standard',
  title: 'ownership_encumbrance',
  title_property: 'ownership_encumbrance',
  heir: 'probate_heirship',
  heir_location: 'probate_heirship'
});

export const OPEN_WEB_PACKAGE_KEYWORDS = Object.freeze({
  standard: ['property owner', 'parcel', 'tax assessment', 'appraisal district'],
  ownership_encumbrance: ['deed index', 'grantor grantee', 'mortgage', 'lien'],
  probate_heirship: ['obituary', 'probate case', 'heir', 'beneficiary'],
  asset_network: ['property holdings', 'grantor grantee', 'entity holdings', 'parcel network'],
  comprehensive: ['property owner', 'deed index', 'probate case', 'heir', 'beneficiary']
});

export const PUBLIC_RECORD_PACKAGE_FAMILIES = Object.freeze({
  standard: ['countyProperty'],
  ownership_encumbrance: ['countyProperty', 'countyRecorder'],
  probate_heirship: ['probateIndex'],
  asset_network: ['countyProperty', 'countyRecorder', 'entitySearch'],
  comprehensive: ['countyProperty', 'countyRecorder', 'probateIndex', 'entitySearch']
});

export function canonicalPackageId(packageId) {
  const normalized = String(packageId || '').trim().toLowerCase();
  if (!normalized) return '';
  return LEGACY_PACKAGE_ALIASES[normalized] || normalized;
}

export function publicRecordFamiliesForPackage(packageId) {
  return PUBLIC_RECORD_PACKAGE_FAMILIES[canonicalPackageId(packageId)] || [];
}

export function packageSupportsPublicRecordFamily(packageId, family) {
  return publicRecordFamiliesForPackage(packageId).includes(family);
}

export function openWebKeywordsForPackage(packageId) {
  const canonical = canonicalPackageId(packageId) || 'standard';
  return OPEN_WEB_PACKAGE_KEYWORDS[canonical] || OPEN_WEB_PACKAGE_KEYWORDS.standard;
}
