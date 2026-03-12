/**
 * TraceWorks Connector Registry
 * All connectors export: connectorName, description, inputSchema, rateLimit, runConnector()
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FREE OSINT STACK — No paid APIs. All public-record sources.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Tool               | What it does                          | Tier(s)
 * ─────────────────────────────────────────────────────────────────────────────
 * Scrapy             | Crawl county CAD portals, SOS         | T2, T3, T4
 *                    | registries, court indexes             |
 * Playwright (async) | Browser automation for JS-heavy       | T3, T4
 *                    | TX Courts Online, Bexar/other portals |
 * Requests +         | Lightweight HTML extraction from      | T1, T2, T3, T4
 * BeautifulSoup      | TruePeopleSearch, FastPeopleSearch,  |
 *                    | Legacy.com, OpenCorporates            |
 * Trafilatura        | Clean article/body text extraction    | T3, T4
 *                    | from news and obituary pages          |
 * python-whois /     | WHOIS text + RDAP JSON domain/IP      | T1, T2, T4
 * ipwhois            | registration records                  |
 * Wayback Machine    | Historical snapshots via CDX API      | T1, T2, T4
 * CDX API            | (web.archive.org/cdx) — free, no auth |
 * Common Crawl       | Crawl index search via               | T4
 * Index API          | index.commoncrawl.org — free, no auth |
 * DuckDuckGo HTML    | No API key — scrape HTML results page | T1, T2, T3, T4
 *                    | for web intelligence signals          |
 * OpenCorporates     | Free tier company search             | T2, T4
 *                    | api.opencorporates.com/v0.4           |
 * Sherlock-style     | Username enumeration across 20+       | T4
 * username probe     | social/public platforms               |
 * theHarvester-style | Email/name harvesting from contact,   | T4
 * email harvester    | about, staff pages + DDG signals      |
 * Recon-ng-style     | Cross-correlate entities from all     | T4
 * entity graph       | sources into a linked graph           |
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Python engine: tw_engine.py implements T1–T4 as run_tier()
 * JS connectors: this file maps investigation tiers to connector modules
 *
 * Tier → Connector mapping:
 *   standard (T1):              county-property, domain-records, news-search
 *   ownership_encumbrance (T2): county-property, county-recorder, entity-search, domain-records, news-search
 *   probate_heirship (T3):      county-property, probate-index, people-search, address-history, phone-association
 *   asset_network:              county-property, county-recorder, entity-search, corporate-filings, domain-records, news-search, people-search
 *   comprehensive (T4):         all connectors
 *   custom:                     county-property, news-search
 */

export { connectorName as countyPropertyName, runConnector as runCountyProperty } from './county-property.js';
export { connectorName as countyRecorderName, runConnector as runCountyRecorder } from './county-recorder.js';
export { connectorName as probateIndexName, runConnector as runProbateIndex } from './probate-index.js';
export { connectorName as entitySearchName, runConnector as runEntitySearch } from './entity-search.js';
export { connectorName as corporateFilingsName, runConnector as runCorporateFilings } from './corporate-filings.js';
export { connectorName as domainRecordsName, runConnector as runDomainRecords } from './domain-records.js';
export { connectorName as newsSearchName, runConnector as runNewsSearch } from './news-search.js';
export { connectorName as peopleSearchName, runConnector as runPeopleSearch } from './people-search.js';
export { connectorName as addressHistoryName, runConnector as runAddressHistory } from './address-history.js';
export { connectorName as phoneAssociationName, runConnector as runPhoneAssociation } from './phone-association.js';

import * as countyProperty from './county-property.js';
import * as countyRecorder from './county-recorder.js';
import * as probateIndex from './probate-index.js';
import * as entitySearch from './entity-search.js';
import * as corporateFilings from './corporate-filings.js';
import * as domainRecords from './domain-records.js';
import * as newsSearch from './news-search.js';
import * as peopleSearch from './people-search.js';
import * as addressHistory from './address-history.js';
import * as phoneAssociation from './phone-association.js';

export const CONNECTORS = [
  countyProperty,
  countyRecorder,
  probateIndex,
  entitySearch,
  corporateFilings,
  domainRecords,
  newsSearch,
  peopleSearch,
  addressHistory,
  phoneAssociation,
];

export const CONNECTOR_MAP = Object.fromEntries(
  CONNECTORS.map((c) => [c.connectorName, c])
);

/** Connectors to run per investigation tier */
export const TIER_CONNECTORS = {
  // T1 — LOCATE: WHOIS/RDAP, DuckDuckGo, Wayback, basic people index
  standard:              ['county-property', 'domain-records', 'news-search'],

  // T2 — OWNERSHIP: CAD scrape, TX SOS, OpenCorporates, domain records
  ownership_encumbrance: ['county-property', 'county-recorder', 'entity-search', 'domain-records', 'news-search'],

  // T3 — PROBATE: court index, people search, obituary, heir scoring
  probate_heirship:      ['county-property', 'probate-index', 'people-search', 'address-history', 'phone-association'],

  // T3.5 — ASSET NETWORK: ownership + corporate filings + people cross-ref
  asset_network:         ['county-property', 'county-recorder', 'entity-search', 'corporate-filings', 'domain-records', 'news-search', 'people-search'],

  // T4 — COMPREHENSIVE: all modules — Common Crawl, username probe, entity graph
  comprehensive:         ['county-property', 'county-recorder', 'probate-index', 'entity-search', 'corporate-filings', 'domain-records', 'news-search', 'people-search', 'address-history', 'phone-association'],

  // CUSTOM: minimal baseline
  custom:                ['county-property', 'news-search'],
};
