import { runSourceGroup } from './source-runner.js';

function clean(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalized(value) {
  return clean(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function nameVariants(value) {
  const input = clean(value);
  if (!input) return [];

  const commaParts = input.split(',').map(clean).filter(Boolean);
  const tokens = input.replaceAll(',', ' ').split(/\s+/).filter(Boolean);
  const variants = [input];

  if (commaParts.length >= 2) {
    variants.push(`${commaParts.slice(1).join(' ')} ${commaParts[0]}`);
    variants.push(`${commaParts[0]} ${commaParts.slice(1).join(' ')}`);
  } else if (tokens.length >= 2) {
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    const middle = tokens.slice(1, -1).join(' ');
    variants.push(`${last}, ${first}${middle ? ` ${middle}` : ''}`);
    variants.push(`${last} ${first}${middle ? ` ${middle}` : ''}`);
    variants.push(`${first} ${last}`);
    variants.push(last);
  }

  return unique(variants);
}

export function buildPropertySearchTerms({ owner, address, parcel, alternateNames = [] } = {}) {
  const aliases = Array.isArray(alternateNames) ? alternateNames : String(alternateNames || '').split(/[\n,;]+/);
  return unique([
    ...nameVariants(owner),
    ...aliases.flatMap(nameVariants),
    parcel,
    address
  ]).slice(0, 12);
}

function resultKey(row = {}) {
  return normalized(row.propertyId || row.account || row.parcel || row.apn || JSON.stringify(row));
}

function addressMatch(submitted, returned) {
  const left = clean(submitted).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const right = new Set(clean(returned).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean));
  if (!left.length || !right.size) return false;
  const streetNumber = left.find((token) => /^\d+$/.test(token));
  if (streetNumber && !right.has(streetNumber)) return false;
  const meaningful = left.filter((token) => token.length > 2 && !['THE', 'ROAD', 'STREET', 'COUNTY', 'TEXAS'].includes(token));
  return meaningful.filter((token) => right.has(token)).length >= Math.min(2, meaningful.length);
}

function classifyResult(row, { owner, address, parcel, alternateNames = [] }) {
  const reasons = [];
  let level = 'possible';
  const returnedOwner = normalized(row.owner || row.ownerName);
  const returnedAddress = row.address || row.situsAddress || '';
  const returnedParcel = normalized(row.propertyId || row.account || row.parcel || row.apn);
  const requestedParcel = normalized(parcel);
  const requestedNames = unique([owner, ...(Array.isArray(alternateNames) ? alternateNames : [])]);

  if (requestedParcel && returnedParcel && requestedParcel === returnedParcel) {
    level = 'confirmed';
    reasons.push('Exact property identifier match');
  }

  for (const requestedName of requestedNames) {
    const requestedOwner = normalized(requestedName);
    const nameTokens = clean(requestedName).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    if (!requestedOwner || !returnedOwner) continue;
    if (requestedOwner === returnedOwner) {
      level = 'confirmed';
      reasons.push(`Exact owner-name match: ${requestedName}`);
      break;
    }
    if (nameTokens.length >= 2 && nameTokens.every((token) => returnedOwner.includes(normalized(token)))) {
      if (level !== 'confirmed') level = 'likely';
      reasons.push(`All supplied owner-name tokens appear in WCAD owner: ${requestedName}`);
    }
  }

  if (addressMatch(address, returnedAddress)) {
    if (level !== 'confirmed') level = 'likely';
    reasons.push('Submitted address matches WCAD situs address');
  }

  if (!reasons.length) reasons.push('Broad search candidate only; identity not established');
  return { matchLevel: level, matchReasons: [...new Set(reasons)] };
}

function mergeResults(target, rows, query, criteria) {
  for (const raw of rows) {
    const key = resultKey(raw);
    const existing = target.get(key);
    const matchedQueries = unique([...(existing?.matchedQueries || []), query]);
    const classified = classifyResult(raw, criteria);
    const rank = { possible: 1, likely: 2, confirmed: 3 };
    const currentLevel = existing?.matchLevel || 'possible';
    const matchLevel = rank[classified.matchLevel] > rank[currentLevel] ? classified.matchLevel : currentLevel;
    target.set(key, {
      ...(existing || {}),
      ...raw,
      matchLevel,
      matchReasons: unique([...(existing?.matchReasons || []), ...classified.matchReasons]),
      matchedQueries
    });
  }
}

export async function searchCountyProperty({
  county,
  state,
  address,
  owner,
  parcel,
  alternateNames = [],
  configs = [],
  fetchImpl = fetch
}) {
  const baseQuery = { county: county || '', state: state || '', address: address || '', owner: owner || '', parcel: parcel || '' };
  const multipathConfigs = configs.filter((config) => config?.discovery?.multipath === true);
  const regularConfigs = configs.filter((config) => config?.discovery?.multipath !== true);
  const results = new Map();
  const evidence = [];

  if (regularConfigs.length) {
    const out = await runSourceGroup(regularConfigs, () => baseQuery, { fetchImpl });
    mergeResults(results, out.results, owner || address || parcel || '', { owner, address, parcel, alternateNames });
    evidence.push(...out.evidence);
  }

  const terms = buildPropertySearchTerms({ owner, address, parcel, alternateNames });
  for (const term of terms.length ? terms : ['']) {
    if (!multipathConfigs.length) break;
    const query = { ...baseQuery, owner: term };
    const out = await runSourceGroup(multipathConfigs, () => query, { fetchImpl });
    mergeResults(results, out.results, term, { owner, address, parcel, alternateNames });
    evidence.push(...out.evidence);
  }

  return { results: [...results.values()], evidence };
}
