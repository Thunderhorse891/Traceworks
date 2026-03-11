/**
 * TraceWorks Connector Registry
 * All connectors export: connectorName, description, inputSchema, rateLimit, runConnector()
 *
 * Tier → Connector mapping:
 *   standard:              county-property, news-search
 *   ownership_encumbrance: county-property, county-recorder, entity-search, news-search
 *   probate_heirship:      county-property, probate-index, people-search, address-history, phone-association
 *   asset_network:         county-property, county-recorder, entity-search, corporate-filings, news-search
 *   comprehensive:         all connectors
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
  standard:              ['county-property', 'news-search'],
  ownership_encumbrance: ['county-property', 'county-recorder', 'entity-search', 'news-search'],
  probate_heirship:      ['county-property', 'probate-index', 'people-search', 'address-history', 'phone-association'],
  asset_network:         ['county-property', 'county-recorder', 'entity-search', 'corporate-filings', 'news-search'],
  comprehensive:         ['county-property', 'county-recorder', 'probate-index', 'entity-search', 'corporate-filings', 'domain-records', 'news-search', 'people-search', 'address-history', 'phone-association'],
  custom:                ['county-property', 'news-search'],
};
