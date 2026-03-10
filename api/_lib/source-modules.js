/**
 * TraceWorks Source Modules — real scrapers using free public data.
 *
 * All modules return SourceResult objects via makeSourceResult().
 * If a source is blocked, errors, or returns nothing — that is reported
 * honestly. No fake data is ever returned.
 *
 * Free sources used (all legally public):
 *   • Texas county CAD portals (government public records)
 *   • TX Secretary of State (government)
 *   • TX Courts Online (government)
 *   • TruePeopleSearch / FastPeopleSearch (free, public)
 *   • FindAGrave / Legacy.com (free, public obituaries)
 *   • DuckDuckGo Instant Answer API (free, public)
 */

import { makeSourceResult, CONFIDENCE } from './schema.js';

const TIMEOUT_MS = 12000;

function tw(ms = TIMEOUT_MS) { return AbortSignal.timeout(ms); }

function browserHeaders(referer = null) {
  const h = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'DNT': '1',
    'Cache-Control': 'no-cache',
  };
  if (referer) h['Referer'] = referer;
  return h;
}

function clean(str) {
  return String(str || '').replace(/\s+/g, ' ').trim();
}

// ── ENTITY DETECTION (pure logic, always works) ───────────────

const ENTITY_MARKERS = [
  'LLC', 'L.L.C.', 'LP', 'L.P.', 'LLP', 'L.L.P.',
  'CORP', 'CORPORATION', 'INC', 'INCORPORATED',
  'TRUST', 'ESTATE', 'HOLDINGS', 'PROPERTIES',
  'INVESTMENTS', 'PARTNERS', 'GROUP', 'FUND',
  'ASSOCIATION', 'FOUNDATION', 'COMPANY', 'CO.',
];

export function entityOwnerDetector(ownerName) {
  if (!ownerName) return { isEntity: false, entityType: null, normalizedName: '' };
  const upper = ownerName.toUpperCase();
  const match = ENTITY_MARKERS.find((m) => {
    const re = new RegExp(`\\b${m.replace('.', '\\.')}\\b`, 'i');
    return re.test(upper);
  });
  return {
    isEntity: Boolean(match),
    entityType: match
      ? (upper.includes('TRUST') ? 'Trust'
        : upper.includes('ESTATE') ? 'Estate'
        : ['LLC', 'L.L.C.'].some((m) => upper.includes(m)) ? 'LLC'
        : ['LP', 'LLP'].some((m) => upper.includes(m)) ? 'Partnership'
        : 'Corporation')
      : null,
    normalizedName: ownerName.trim(),
  };
}

// ── TEXAS CAD SCRAPER ─────────────────────────────────────────
// Supports Harris, Travis, Williamson, Bexar, Dallas — largest TX counties.
// Falls back to a generic CAD URL for other counties.

const CAD_URLS = {
  harris:     'https://hcad.org/property-search/real-property/',
  travis:     'https://www.traviscad.org/propertysearch/',
  williamson: 'https://www.wcad.org/online-property-search/',
  bexar:      'https://www.bcad.org/clientdb/',
  dallas:     'https://www.dallascad.org/SearchAddr.aspx',
  tarrant:    'https://www.tad.org/tad_search/full_search.php',
  collin:     'https://www.collincad.org/propertysearch/',
  denton:     'https://www.dentoncad.com/property-search/',
  montgomery: 'https://mcad-tx.org/propertysearch/',
  galveston:  'https://galvestoncad.org/PropertySearch/',
};

export async function texasCADScraper(county, query, fetchImpl = fetch) {
  const countyLower = (county || '').toLowerCase().trim();
  const cadUrl = CAD_URLS[countyLower] || `https://www.${countyLower}cad.org/`;
  const queriedAt = new Date().toISOString();
  const sourceId  = `${countyLower}_cad`;
  const label     = `${county} County Appraisal District`;

  // Harris County has a JSON API — real data extraction possible
  if (countyLower === 'harris') {
    try {
      const searchUrl = `https://hcad.org/api/search?searchVal=${encodeURIComponent(query)}&searchCriteria=address`;
      const res = await fetchImpl(searchUrl, {
        headers: { ...browserHeaders(cadUrl), 'Accept': 'application/json' },
        signal: tw(),
      });
      if (res.status === 429) {
        return makeSourceResult({ sourceId, sourceLabel: label, sourceUrl: cadUrl, queryUsed: query, queriedAt, status: 'blocked', errorDetail: 'Rate limited (HTTP 429) — try again later', data: null, confidence: 'unavailable' });
      }
      if (!res.ok) {
        return makeSourceResult({ sourceId, sourceLabel: label, sourceUrl: cadUrl, queryUsed: query, queriedAt, status: 'error', errorDetail: `HTTP ${res.status}`, data: null, confidence: 'unavailable' });
      }
      const json = await res.json();
      const properties = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
      if (properties.length === 0) {
        return makeSourceResult({ sourceId, sourceLabel: label, sourceUrl: cadUrl, queryUsed: query, queriedAt, status: 'not_found', data: null, confidence: 'not_found' });
      }
      const mapped = properties.slice(0, 5).map((p) => ({
        parcelId:      clean(p.acct || p.account || p.parcel_id || ''),
        ownerName:     clean(p.owner || p.owner_name || ''),
        situsAddress:  clean(p.situs || p.address || ''),
        legalDesc:     clean(p.legal || p.legal_description || ''),
        assessedValue: clean(p.appraised_val || p.assessed_value || ''),
        taxYear:       clean(p.tax_year || ''),
        propertyClass: clean(p.state_class || p.property_type || ''),
      }));
      return makeSourceResult({ sourceId, sourceLabel: label, sourceUrl: cadUrl, queryUsed: query, queriedAt, status: 'found', data: { properties: mapped, totalReturned: properties.length }, confidence: mapped.length >= 1 ? 'likely' : 'possible' });
    } catch (err) {
      const detail = err.name === 'TimeoutError' ? `Timeout after ${TIMEOUT_MS}ms` : err.message;
      return makeSourceResult({ sourceId, sourceLabel: label, sourceUrl: cadUrl, queryUsed: query, queriedAt, status: 'error', errorDetail: detail, data: null, confidence: 'unavailable' });
    }
  }

  // For all other TX counties: attempt to reach the portal and confirm availability
  try {
    const res = await fetchImpl(cadUrl, { headers: browserHeaders(), signal: tw(8000) });
    const reachable = res.ok || res.status === 200;
    return makeSourceResult({
      sourceId,
      sourceLabel: label,
      sourceUrl: cadUrl,
      queryUsed: query,
      queriedAt,
      status: 'unavailable',
      errorDetail: reachable
        ? `SOURCE_REQUIRES_MANUAL_REVIEW — ${label} portal is reachable but requires browser interaction to search. Access directly: ${cadUrl} — search for: "${query}"`
        : `SOURCE_REQUIRES_MANUAL_REVIEW — ${label} portal could not be reached. Try manually: ${cadUrl}`,
      data: null,
      confidence: 'manual_review',
    });
  } catch {
    return makeSourceResult({
      sourceId, sourceLabel: label, sourceUrl: cadUrl, queryUsed: query, queriedAt,
      status: 'unavailable',
      errorDetail: `SOURCE_REQUIRES_MANUAL_REVIEW — ${label} requires direct browser access: ${cadUrl}`,
      data: null, confidence: 'manual_review',
    });
  }
}

// ── TX SECRETARY OF STATE — ENTITY SEARCH ─────────────────────

export async function txSOSScraper(entityName, fetchImpl = fetch) {
  const queriedAt  = new Date().toISOString();
  const sourceUrl  = 'https://mycpa.cpa.state.tx.us/coa/';
  const queryUsed  = entityName;

  try {
    // TX Comptroller COA search (public, government)
    const searchUrl = `https://mycpa.cpa.state.tx.us/coa/cosearch.do?action=NAMEONLY&firstchar=&name=${encodeURIComponent(entityName)}&searchtype=NAME`;
    const res = await fetchImpl(searchUrl, { headers: browserHeaders(sourceUrl), signal: tw() });

    if (!res.ok) {
      return makeSourceResult({ sourceId: 'tx_sos', sourceLabel: 'TX Secretary of State / Comptroller', sourceUrl, queryUsed, queriedAt, status: 'error', errorDetail: `HTTP ${res.status}`, data: null, confidence: 'unavailable' });
    }

    const html = await res.text();
    // Dynamically import cheerio for parsing
    const { load } = await import('cheerio');
    const $ = load(html);

    const results = [];
    // The TX COA search returns a table of entities
    $('table tr').each((i, row) => {
      if (i === 0) return; // header
      const cells = $(row).find('td');
      if (cells.length < 3) return;
      const name   = clean($(cells[0]).text());
      const status = clean($(cells[1]).text());
      const type   = clean($(cells[2]).text());
      if (name) results.push({ entityName: name, status, entityType: type });
    });

    if (results.length === 0) {
      return makeSourceResult({ sourceId: 'tx_sos', sourceLabel: 'TX Secretary of State', sourceUrl, queryUsed, queriedAt, status: 'not_found', data: null, confidence: 'not_found' });
    }

    return makeSourceResult({
      sourceId: 'tx_sos',
      sourceLabel: 'TX Secretary of State Entity Search',
      sourceUrl,
      queryUsed,
      queriedAt,
      status: 'found',
      data: { entities: results.slice(0, 10), totalReturned: results.length },
      confidence: results.length >= 2 ? 'likely' : 'possible',
    });
  } catch (err) {
    const detail = err.name === 'TimeoutError' ? `Timeout after ${TIMEOUT_MS}ms` : err.message;
    return makeSourceResult({ sourceId: 'tx_sos', sourceLabel: 'TX Secretary of State', sourceUrl, queryUsed, queriedAt, status: 'error', errorDetail: detail, data: null, confidence: 'unavailable' });
  }
}

// ── TX COURTS ONLINE — PROBATE / CIVIL SEARCH ────────────────

export async function txCourtsOnlineScraper(name, county, fetchImpl = fetch) {
  const queriedAt = new Date().toISOString();
  const sourceUrl = 'https://publicaccess.courts.state.tx.us/';
  const queryUsed = `${name} | ${county} County`;

  // TX Courts Online requires a POST form interaction with session state — not automatable
  // without a browser. Return a clean manual review notice with the direct URL.
  return makeSourceResult({
    sourceId: 'tx_courts_online',
    sourceLabel: 'TX Courts Online (Probate/Civil)',
    sourceUrl,
    queryUsed,
    queriedAt,
    status: 'unavailable',
    errorDetail: `SOURCE_REQUIRES_MANUAL_REVIEW — TX Courts Online requires browser session authentication. Search manually at ${sourceUrl} — search by party name: "${name}", county: "${county}". Look for Probate, Estate, and Civil case types.`,
    data: null,
    confidence: 'manual_review',
  });
}

// ── TRUEPEOPLESEARCH ──────────────────────────────────────────

export async function truePeopleSearchScraper(firstName, lastName, state = 'TX', fetchImpl = fetch) {
  const queriedAt = new Date().toISOString();
  const url = `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(`${firstName} ${lastName}`)}&citystatezip=${encodeURIComponent(state)}`;

  try {
    const res = await fetchImpl(url, { headers: browserHeaders('https://www.truepeoplesearch.com/'), signal: tw() });

    if (res.status === 429) {
      return makeSourceResult({ sourceId: 'truepeoplesearch', sourceLabel: 'TruePeopleSearch', sourceUrl: url, queryUsed: `${firstName} ${lastName} ${state}`, queriedAt, status: 'blocked', errorDetail: 'Rate limited (HTTP 429)', data: null, confidence: 'unavailable' });
    }
    if (!res.ok) {
      return makeSourceResult({ sourceId: 'truepeoplesearch', sourceLabel: 'TruePeopleSearch', sourceUrl: url, queryUsed: `${firstName} ${lastName} ${state}`, queriedAt, status: 'error', errorDetail: `HTTP ${res.status}`, data: null, confidence: 'unavailable' });
    }

    const html  = await res.text();
    const { load } = await import('cheerio');
    const $ = load(html);

    const people = [];
    $('.card-summary, [data-link-to-details]').each((i, card) => {
      if (i >= 5) return false;
      const name = clean($(card).find('.h4, h2, .name').first().text());
      const addrs = [];
      $(card).find('.content-value, .address, [class*="address"]').each((_, el) => {
        const t = clean($(el).text());
        if (/\d{2,6}\s+\w/.test(t) && t.length > 8) addrs.push(t);
      });
      const phones = [];
      $(card).find('[href^="tel:"], .phone, [class*="phone"]').each((_, el) => {
        const p = $(el).text().replace(/[^\d()\-. ]/g, '').trim();
        if (p.replace(/\D/g, '').length === 10) phones.push(p);
      });
      const relatives = [];
      $(card).find('.relative, .link-to-details, [class*="relative"]').slice(0, 5).each((_, el) => {
        const t = clean($(el).text());
        if (t && t.length > 3) relatives.push(t);
      });
      if (name || addrs.length) people.push({ name, addresses: addrs, phones, relatives });
    });

    if (people.length === 0) {
      return makeSourceResult({ sourceId: 'truepeoplesearch', sourceLabel: 'TruePeopleSearch', sourceUrl: url, queryUsed: `${firstName} ${lastName} ${state}`, queriedAt, status: 'not_found', data: null, confidence: 'not_found' });
    }

    return makeSourceResult({
      sourceId: 'truepeoplesearch',
      sourceLabel: 'TruePeopleSearch',
      sourceUrl: url,
      queryUsed: `${firstName} ${lastName} ${state}`,
      queriedAt,
      status: 'found',
      data: { people: people.slice(0, 5), totalReturned: people.length },
      confidence: people.length >= 2 ? 'likely' : 'possible',
    });
  } catch (err) {
    const detail = err.name === 'TimeoutError' ? `Timeout after ${TIMEOUT_MS}ms` : err.message;
    return makeSourceResult({ sourceId: 'truepeoplesearch', sourceLabel: 'TruePeopleSearch', sourceUrl: url, queryUsed: `${firstName} ${lastName} ${state}`, queriedAt, status: 'error', errorDetail: detail, data: null, confidence: 'unavailable' });
  }
}

// ── FASTPEOPLESEARCH ──────────────────────────────────────────

export async function fastPeopleSearchScraper(firstName, lastName, state = 'TX', fetchImpl = fetch) {
  const queriedAt = new Date().toISOString();
  const url = `https://www.fastpeoplesearch.com/name/${encodeURIComponent(firstName)}-${encodeURIComponent(lastName)}_${state}`;

  try {
    const res = await fetchImpl(url, { headers: browserHeaders('https://www.fastpeoplesearch.com/'), signal: tw() });

    if (res.status === 429) {
      return makeSourceResult({ sourceId: 'fastpeoplesearch', sourceLabel: 'FastPeopleSearch', sourceUrl: url, queryUsed: `${firstName} ${lastName} ${state}`, queriedAt, status: 'blocked', errorDetail: 'Rate limited (HTTP 429)', data: null, confidence: 'unavailable' });
    }
    if (!res.ok) {
      return makeSourceResult({ sourceId: 'fastpeoplesearch', sourceLabel: 'FastPeopleSearch', sourceUrl: url, queryUsed: `${firstName} ${lastName} ${state}`, queriedAt, status: 'error', errorDetail: `HTTP ${res.status}`, data: null, confidence: 'unavailable' });
    }

    const html = await res.text();
    const { load } = await import('cheerio');
    const $ = load(html);

    const people = [];
    $('.card, .result-card, [class*="card"]').each((i, card) => {
      if (i >= 5) return false;
      const name = clean($(card).find('h2, h3, .name, [class*="name"]').first().text());
      const addrs = [];
      $(card).find('.address, [class*="addr"]').each((_, el) => {
        const t = clean($(el).text());
        if (/\d+\s+\w/.test(t) && t.length > 8) addrs.push(t);
      });
      const phones = [];
      $('a[href^="tel:"]', card).each((_, el) => {
        const p = $(el).text().replace(/[^\d()\-. ]/g, '').trim();
        if (p.replace(/\D/g, '').length === 10) phones.push(p);
      });
      const relatives = [];
      $(card).find('.relative-name, .person-name').slice(0, 4).each((_, el) => {
        const t = clean($(el).text());
        if (t && t.length > 3) relatives.push(t);
      });
      if (name || addrs.length) people.push({ name, addresses: addrs, phones, relatives });
    });

    if (people.length === 0) {
      return makeSourceResult({ sourceId: 'fastpeoplesearch', sourceLabel: 'FastPeopleSearch', sourceUrl: url, queryUsed: `${firstName} ${lastName} ${state}`, queriedAt, status: 'not_found', data: null, confidence: 'not_found' });
    }

    return makeSourceResult({
      sourceId: 'fastpeoplesearch',
      sourceLabel: 'FastPeopleSearch',
      sourceUrl: url,
      queryUsed: `${firstName} ${lastName} ${state}`,
      queriedAt,
      status: 'found',
      data: { people: people.slice(0, 5), totalReturned: people.length },
      confidence: people.length >= 2 ? 'likely' : 'possible',
    });
  } catch (err) {
    const detail = err.name === 'TimeoutError' ? `Timeout after ${TIMEOUT_MS}ms` : err.message;
    return makeSourceResult({ sourceId: 'fastpeoplesearch', sourceLabel: 'FastPeopleSearch', sourceUrl: url, queryUsed: `${firstName} ${lastName} ${state}`, queriedAt, status: 'error', errorDetail: detail, data: null, confidence: 'unavailable' });
  }
}

// ── FINDAGRAVE / OBITUARY SEARCH ──────────────────────────────

export async function obituaryIndexScraper(name, county, state = 'TX', fetchImpl = fetch) {
  const queriedAt = new Date().toISOString();
  const query = `${name} ${county} ${state} obituary`;
  const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const legacyUrl = `https://www.legacy.com/obituaries/search?keyword=${encodeURIComponent(name)}&location=${encodeURIComponent(`${county}, ${state}`)}`;

  try {
    const res = await fetchImpl(ddgUrl, { signal: tw(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const topics  = Array.isArray(json.RelatedTopics) ? json.RelatedTopics : [];
    const hits    = topics
      .flatMap((t) => Array.isArray(t.Topics) ? t.Topics : [t])
      .filter((t) => t.FirstURL && (t.Text || '').toLowerCase().includes(name.toLowerCase().split(' ')[0]))
      .slice(0, 5)
      .map((t) => ({ title: clean(t.Text), url: t.FirstURL }));

    if (hits.length === 0) {
      return makeSourceResult({
        sourceId: 'obituary_index',
        sourceLabel: 'Obituary / Death Record Index',
        sourceUrl: legacyUrl,
        queryUsed: query,
        queriedAt,
        status: 'not_found',
        errorDetail: `No obituary results found for "${name}" in ${county}, ${state}. Manual search recommended at: legacy.com, findagrave.com`,
        data: null,
        confidence: 'not_found',
      });
    }

    return makeSourceResult({
      sourceId: 'obituary_index',
      sourceLabel: 'Obituary / Death Record Index (DuckDuckGo + Legacy.com)',
      sourceUrl: legacyUrl,
      queryUsed: query,
      queriedAt,
      status: 'found',
      data: { obituaries: hits },
      confidence: 'possible', // DuckDuckGo results need manual verification
    });
  } catch (err) {
    const detail = err.name === 'TimeoutError' ? `Timeout after ${TIMEOUT_MS}ms` : err.message;
    return makeSourceResult({
      sourceId: 'obituary_index', sourceLabel: 'Obituary / Death Record Index',
      sourceUrl: legacyUrl, queryUsed: query, queriedAt,
      status: 'error', errorDetail: detail, data: null, confidence: 'unavailable',
    });
  }
}

// ── DUCKDUCKGO SUBJECT SEARCH (supplemental signal) ───────────

export async function duckDuckGoSearch(query, fetchImpl = fetch) {
  const queriedAt = new Date().toISOString();
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

  try {
    const res = await fetchImpl(url, { signal: tw(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const topics = Array.isArray(json.RelatedTopics) ? json.RelatedTopics : [];
    const hits   = topics
      .flatMap((t) => Array.isArray(t.Topics) ? t.Topics : [t])
      .filter((t) => t.FirstURL)
      .slice(0, 8)
      .map((t) => ({ title: clean(t.Text), url: t.FirstURL }));

    if (hits.length === 0) {
      return makeSourceResult({ sourceId: 'duckduckgo', sourceLabel: 'DuckDuckGo Public Web Search', sourceUrl: url, queryUsed: query, queriedAt, status: 'not_found', data: null, confidence: 'not_found' });
    }

    return makeSourceResult({
      sourceId: 'duckduckgo',
      sourceLabel: 'DuckDuckGo Public Web Search',
      sourceUrl: url,
      queryUsed: query,
      queriedAt,
      status: 'found',
      data: { results: hits },
      confidence: 'possible',
    });
  } catch (err) {
    const detail = err.name === 'TimeoutError' ? `Timeout after ${TIMEOUT_MS}ms` : err.message;
    return makeSourceResult({ sourceId: 'duckduckgo', sourceLabel: 'DuckDuckGo Public Web Search', sourceUrl: url, queryUsed: query, queriedAt, status: 'error', errorDetail: detail, data: null, confidence: 'unavailable' });
  }
}

// ── HEIR CANDIDATE SCORER (pure logic, no HTTP) ───────────────

export function heirCandidateScorer(candidates, subjectLastName) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  return candidates.map((c) => {
    let score = 0;
    const nameMatch = c.name && c.name.toUpperCase().includes((subjectLastName || '').toUpperCase());
    if (nameMatch) score += 3;
    if (c.addresses && c.addresses.length > 0) score += 2;
    if (c.phones && c.phones.length > 0) score += 1;
    if (c.relatives && c.relatives.length > 0) score += 1;

    const rating = score >= 5 ? 'probable' : score >= 3 ? 'possible' : 'low-confidence';
    const confidence = rating === 'probable' ? 'likely' : rating === 'possible' ? 'possible' : 'not_verified';

    return { ...c, heirRating: rating, heirScore: score, confidence };
  }).sort((a, b) => b.heirScore - a.heirScore);
}

// ── COUNTY DEED INDEX (manual review — requires county-specific portals) ──

export function countyDeedIndexUnavailable(county, state, query) {
  const url = `https://www.${(county || '').toLowerCase()}countyclerk.${(state || 'tx').toLowerCase()}.gov/`;
  return makeSourceResult({
    sourceId: `${(county || 'county').toLowerCase()}_deed_index`,
    sourceLabel: `${county} County Clerk Deed Index`,
    sourceUrl: url,
    queryUsed: query,
    queriedAt: new Date().toISOString(),
    status: 'unavailable',
    errorDetail: `SOURCE_REQUIRES_MANUAL_REVIEW — County deed indexes require browser-based access with session authentication. Search manually: look up "${query}" in the grantor/grantee index at the ${county} County Clerk's portal.`,
    data: null,
    confidence: 'manual_review',
  });
}
