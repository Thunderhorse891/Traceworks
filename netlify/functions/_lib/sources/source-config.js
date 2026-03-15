import { canonicalPackageId, publicRecordFamiliesForPackage } from '../package-contract.js';

const TEXAS_FIRST_SOURCE_CONFIG = {
  countyProperty: [
    {
      id: 'tx_harris_appraisal',
      name: 'Harris County Appraisal District',
      type: 'html',
      coverage: { states: ['TX'], counties: ['Harris'] },
      request: { urlTemplate: 'https://hcad.org/property-search/property-search-results/?q={owner}', method: 'GET' },
      extraction: {
        itemRegex: '<tr[^>]*>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>',
        map: { account: 1, owner: 2, address: 3 }
      }
    },
    {
      id: 'tx_travis_appraisal',
      name: 'Travis Central Appraisal District',
      type: 'html',
      coverage: { states: ['TX'], counties: ['Travis'] },
      request: { urlTemplate: 'https://www.traviscad.org/propertysearch?owner={owner}', method: 'GET' },
      extraction: {
        itemRegex: '<tr[^>]*>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>',
        map: { account: 1, owner: 2, address: 3 }
      }
    },
    {
      id: 'tx_dallas_appraisal',
      name: 'Dallas Central Appraisal District',
      type: 'html',
      coverage: { states: ['TX'], counties: ['Dallas'] },
      request: { urlTemplate: 'https://www.dallascad.org/SearchOwner.aspx?owner={owner}', method: 'GET' },
      extraction: {
        itemRegex: '<tr[^>]*>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>',
        map: { account: 1, owner: 2, address: 3 }
      }
    },
    {
      id: 'tx_bexar_appraisal',
      name: 'Bexar Appraisal District',
      type: 'html',
      coverage: { states: ['TX'], counties: ['Bexar'] },
      request: { urlTemplate: 'https://www.bcad.org/clientdb/?cid=1&owner={owner}', method: 'GET' },
      extraction: {
        itemRegex: '<tr[^>]*>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>',
        map: { account: 1, owner: 2, address: 3 }
      }
    },
    {
      id: 'tx_tarrant_appraisal',
      name: 'Tarrant Appraisal District',
      type: 'html',
      coverage: { states: ['TX'], counties: ['Tarrant'] },
      request: { urlTemplate: 'https://www.tad.org/property/search?owner={owner}', method: 'GET' },
      extraction: {
        itemRegex: '<tr[^>]*>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>',
        map: { account: 1, owner: 2, address: 3 }
      }
    }
  ],
  countyRecorder: [
    {
      id: 'tx_harris_clerk_real_property',
      name: 'Harris County Clerk Real Property Search',
      type: 'html',
      coverage: { states: ['TX'], counties: ['Harris'] },
      request: { urlTemplate: 'https://www.cclerk.hctx.net/applications/websearch/RP.aspx?name={owner}', method: 'GET' },
      extraction: {
        itemRegex: '<tr[^>]*>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>',
        map: { recordingDate: 1, instrumentType: 2, grantorGrantee: 3, instrumentNumber: 4 }
      }
    },
    {
      id: 'tx_dallas_county_clerk',
      name: 'Dallas County Clerk Recorder Search',
      type: 'html',
      coverage: { states: ['TX'], counties: ['Dallas'] },
      request: { urlTemplate: 'https://www.dallascounty.org/government/county-clerk/recording/search.php?name={owner}', method: 'GET' },
      extraction: {
        itemRegex: '<tr[^>]*>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>',
        map: { recordingDate: 1, instrumentType: 2, grantorGrantee: 3, instrumentNumber: 4 }
      }
    }
  ],
  probateIndex: [
    {
      id: 'tx_travis_probate_index',
      name: 'Travis County Probate Search',
      type: 'html',
      coverage: { states: ['TX'], counties: ['Travis'] },
      request: { urlTemplate: 'https://odysseyweb.traviscountytx.gov/Portal/Home/WorkspaceMode?p={decedent}', method: 'GET' },
      extraction: {
        itemRegex: '<tr[^>]*>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>',
        map: { caseNumber: 1, filingDate: 2, status: 3 }
      }
    },
    {
      id: 'tx_tarrant_probate_index',
      name: 'Tarrant County Probate Search',
      type: 'html',
      coverage: { states: ['TX'], counties: ['Tarrant'] },
      request: { urlTemplate: 'https://courts.tarrantcounty.com/Case/Search?name={decedent}', method: 'GET' },
      extraction: {
        itemRegex: '<tr[^>]*>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>',
        map: { caseNumber: 1, filingDate: 2, status: 3 }
      }
    }
  ],
  entitySearch: [
    {
      id: 'tx_sos_entity_search',
      name: 'Texas Secretary of State Entity Search',
      type: 'html',
      coverage: { states: ['TX'] },
      request: { urlTemplate: 'https://mycpa.cpa.state.tx.us/coa/search.do?entityName={entityName}', method: 'GET' },
      extraction: {
        itemRegex: '<tr[^>]*>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>',
        map: { entityName: 1, state: 2, status: 3, filingNumber: 4 }
      }
    },
    {
      id: 'opencorporates_company_search',
      name: 'OpenCorporates Company Search',
      type: 'json',
      request: { urlTemplate: 'https://api.opencorporates.com/v0.4/companies/search?q={entityName}&per_page=5', method: 'GET' },
      extraction: {
        itemsPath: 'results.companies',
        map: { entityName: 'company.name', state: 'company.jurisdiction_code', status: 'company.current_status', filingNumber: 'company.company_number' }
      }
    },
    {
      id: 'sec_edgar_company_search',
      name: 'SEC EDGAR Company Search',
      type: 'html',
      request: { urlTemplate: 'https://www.sec.gov/edgar/search/#/q={entityName}', method: 'GET', headers: { 'user-agent': 'TraceWorks public records research' } },
      extraction: {
        itemRegex: '<h4[^>]*>([^<]*)</h4>',
        map: { entityName: 1 }
      }
    }
  ]
};

export const SOURCE_CONFIG_FAMILIES = Object.freeze([
  'countyProperty',
  'countyRecorder',
  'probateIndex',
  'entitySearch'
]);

const FAMILY_LABELS = Object.freeze({
  countyProperty: 'County property',
  countyRecorder: 'County recorder',
  probateIndex: 'Probate index',
  entitySearch: 'Entity registry'
});

function normalizeState(value) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeCounty(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+county$/i, '')
    .replace(/\s+/g, ' ');
}

function normalizeCoverageItems(values, normalizer) {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  return list.map((value) => normalizer(value)).filter(Boolean);
}

function configCoversJurisdiction(config, { county, state }) {
  const configuredStates = normalizeCoverageItems(config?.coverage?.states, normalizeState);
  const configuredCounties = normalizeCoverageItems(config?.coverage?.counties, normalizeCounty);
  const queryState = normalizeState(state);
  const queryCounty = normalizeCounty(county);

  if (configuredStates.length && (!queryState || !configuredStates.includes(queryState))) return false;
  if (configuredCounties.length && (!queryCounty || !configuredCounties.includes(queryCounty))) return false;
  return true;
}

function familyRequiredForInput(family, input = {}) {
  if (family !== 'entitySearch') return true;
  return normalizeState(input.subjectType || '').toLowerCase() === 'entity' && String(input.subjectName || input.entityName || '').trim().length > 0;
}

function familyLabel(family) {
  return FAMILY_LABELS[family] || family;
}

function locationLabel({ county, state } = {}) {
  const countyLabel = String(county || '').trim();
  const stateLabel = normalizeState(state);
  if (countyLabel && stateLabel) return `${countyLabel} County, ${stateLabel}`;
  return countyLabel || stateLabel || 'the requested jurisdiction';
}

function normalizeSourceConfig(parsed = {}) {
  return {
    countyProperty: Array.isArray(parsed.countyProperty) ? parsed.countyProperty : TEXAS_FIRST_SOURCE_CONFIG.countyProperty,
    countyRecorder: Array.isArray(parsed.countyRecorder) ? parsed.countyRecorder : TEXAS_FIRST_SOURCE_CONFIG.countyRecorder,
    probateIndex: Array.isArray(parsed.probateIndex) ? parsed.probateIndex : TEXAS_FIRST_SOURCE_CONFIG.probateIndex,
    entitySearch: Array.isArray(parsed.entitySearch) ? parsed.entitySearch : TEXAS_FIRST_SOURCE_CONFIG.entitySearch
  };
}

export function summarizeSourceConfig(config = TEXAS_FIRST_SOURCE_CONFIG) {
  const families = {};
  let totalSources = 0;
  let browserBackedSources = 0;

  for (const family of SOURCE_CONFIG_FAMILIES) {
    const items = Array.isArray(config?.[family]) ? config[family] : [];
    families[family] = items.length;
    totalSources += items.length;
    browserBackedSources += items.filter((item) => item?.type === 'browser').length;
  }

  return {
    families,
    totalSources,
    browserBackedSources
  };
}

export function findStrictSourceConfigGaps(config = TEXAS_FIRST_SOURCE_CONFIG) {
  return SOURCE_CONFIG_FAMILIES.filter((family) => !Array.isArray(config?.[family]) || config[family].length === 0);
}

export function loadSourceConfig(env = process.env) {
  const raw = String(env.PUBLIC_RECORD_SOURCE_CONFIG || '').trim();
  if (!raw) return TEXAS_FIRST_SOURCE_CONFIG;
  try {
    return normalizeSourceConfig(JSON.parse(raw));
  } catch {
    throw new Error('PUBLIC_RECORD_SOURCE_CONFIG must be valid JSON.');
  }
}

export function usingBundledSourceConfig(env = process.env) {
  return !String(env.PUBLIC_RECORD_SOURCE_CONFIG || '').trim();
}

export function assessPackageJurisdictionCoverage({ packageId, input = {}, env = process.env }) {
  const canonicalPackage = canonicalPackageId(packageId) || 'standard';
  const sourceConfig = loadSourceConfig(env);
  const requestedFamilies = publicRecordFamiliesForPackage(canonicalPackage);
  const targetLocation = locationLabel(input);

  const familyCoverage = requestedFamilies.map((family) => {
    const configs = Array.isArray(sourceConfig?.[family]) ? sourceConfig[family] : [];
    const required = familyRequiredForInput(family, input);
    const inScopeConfigs = required
      ? configs.filter((config) => configCoversJurisdiction(config, input))
      : [];
    const automatedConfigs = inScopeConfigs.filter((config) => config?.type !== 'browser');
    const browserBackedConfigs = inScopeConfigs.filter((config) => config?.type === 'browser');

    let detail = `${familyLabel(family)} coverage is not required for this intake.`;
    if (required && !configs.length) {
      detail = `No ${familyLabel(family).toLowerCase()} sources are configured for this runtime.`;
    } else if (required && !inScopeConfigs.length) {
      detail = `No ${familyLabel(family).toLowerCase()} sources currently cover ${targetLocation}.`;
    } else if (required && !automatedConfigs.length && browserBackedConfigs.length) {
      detail = `${browserBackedConfigs.length} in-scope ${familyLabel(family).toLowerCase()} source(s) are browser-backed and will likely require manual review in the current runtime.`;
    } else if (required) {
      detail = `${automatedConfigs.length} automated ${familyLabel(family).toLowerCase()} source(s) currently cover ${targetLocation}.`;
    }

    return {
      family,
      label: familyLabel(family),
      required,
      configuredSources: configs.length,
      inScopeSources: inScopeConfigs.length,
      automatedSources: automatedConfigs.length,
      browserBackedSources: browserBackedConfigs.length,
      ready: !required || inScopeConfigs.length > 0,
      detail
    };
  });

  const blockingFamilies = familyCoverage.filter((family) => family.required && family.inScopeSources === 0);
  const manualReviewFamilies = familyCoverage.filter((family) => family.required && family.inScopeSources > 0 && family.automatedSources === 0);

  return {
    packageId: canonicalPackage,
    locationLabel: targetLocation,
    requestedFamilies,
    familyCoverage,
    coverageReady: blockingFamilies.length === 0,
    blockingFamilies,
    manualReviewFamilies,
    summary: blockingFamilies.length
      ? `${canonicalPackage} is missing automated jurisdiction coverage for ${targetLocation}.`
      : manualReviewFamilies.length
        ? `${canonicalPackage} covers ${targetLocation}, but at least one required family is browser-backed in the current runtime.`
        : `${canonicalPackage} has in-scope automated source coverage for ${targetLocation}.`
  };
}
