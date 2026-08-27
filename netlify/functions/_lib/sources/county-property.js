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

function uniqueByNormalized(values) {
  const seen = new Set();
  return values.map(clean).filter((value) => {
    const key = normalized(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function words(value) {
  return clean(value)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function sameTokenSet(left, right) {
  const a = uniqueByNormalized(words(left)).sort();
  const b = uniqueByNormalized(words(right)).sort();
  return a.length > 0 && a.length === b.length && a.every((token, index) => token === b[index]);
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
  return buildPropertySearchPaths({ owner, address, parcel, alternateNames }).map((path) => path.term);
}

export function buildPropertySearchPaths({ owner, address, parcel, alternateNames = [] } = {}) {
  const aliases = Array.isArray(alternateNames) ? alternateNames : String(alternateNames || '').split(/[\n,;]+/);
  const paths = [
    ...nameVariants(owner).map((term, index) => ({ term, strategy: index === 0 ? 'submitted_owner' : 'owner_name_variant' })),
    ...aliases.flatMap((alias) => nameVariants(alias).map((term, index) => ({ term, strategy: index === 0 ? 'submitted_alias' : 'alias_name_variant' }))),
    ...(clean(parcel) ? [{ term: parcel, strategy: 'property_identifier' }] : []),
    ...(clean(address) ? [{ term: address, strategy: 'property_address' }] : [])
  ];
  const seen = new Set();
  return paths.filter((path) => {
    const key = clean(path.term).toUpperCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

function resultKey(row = {}) {
  return normalized(row.propertyId || row.account || row.parcel || row.apn || JSON.stringify(row));
}

function addressMatch(submitted, returned) {
  const left = words(submitted);
  const rightTokens = words(returned);
  const right = new Set(rightTokens);
  if (left.length < 2 || right.size < 2) return { matched: false, exact: false };
  const streetNumber = left.find((token) => /^\d+$/.test(token));
  if (!streetNumber || !right.has(streetNumber)) return { matched: false, exact: false };
  const ignored = new Set(['THE', 'ROAD', 'STREET', 'COUNTY', 'TEXAS', 'TX', 'LANE', 'DRIVE', 'AVENUE', 'BOULEVARD']);
  const meaningful = left.filter((token) => token.length > 2 && !ignored.has(token) && !/^\d+$/.test(token));
  if (!meaningful.length) return { matched: false, exact: false };
  const overlap = meaningful.filter((token) => right.has(token)).length;
  return {
    matched: overlap >= Math.min(2, meaningful.length),
    exact: normalized(submitted) === normalized(returned)
  };
}

export function classifyPropertyResult(row, { owner, address, parcel, alternateNames = [] }) {
  const reasons = [];
  const conflicts = [];
  let level = 'possible';
  let score = 20;
  const returnedOwner = normalized(row.owner || row.ownerName);
  const returnedOwnerLabel = row.owner || row.ownerName || '';
  const returnedAddress = row.address || row.situsAddress || '';
  const requestedParcel = normalized(parcel);
  const requestedNames = unique([owner, ...(Array.isArray(alternateNames) ? alternateNames : [])]);
  const returnedIdentifiers = unique([row.propertyId, row.account, row.parcel, row.apn, row.propertyNumber]).map(normalized);

  if (requestedParcel && returnedIdentifiers.includes(requestedParcel)) {
    level = 'confirmed';
    score = 100;
    reasons.push('Exact property identifier match');
  }

  for (const requestedName of requestedNames) {
    const requestedOwner = normalized(requestedName);
    const nameTokens = words(requestedName);
    if (!requestedOwner || !returnedOwner) continue;
    if (requestedOwner === returnedOwner || sameTokenSet(requestedName, returnedOwnerLabel)) {
      level = 'confirmed';
      score = Math.max(score, 95);
      reasons.push(`Exact owner-name match: ${requestedName}`);
      break;
    }
    if (nameTokens.length >= 2 && nameTokens.every((token) => returnedOwner.includes(normalized(token)))) {
      if (level !== 'confirmed') level = 'likely';
      score = Math.max(score, 82);
      reasons.push(`All supplied owner-name tokens appear in WCAD owner: ${requestedName}`);
    }
  }

  const addressResult = addressMatch(address, returnedAddress);
  if (addressResult.matched) {
    if (addressResult.exact && level !== 'confirmed') level = 'confirmed';
    else if (level !== 'confirmed') level = 'likely';
    score = Math.max(score, addressResult.exact ? 95 : 85);
    reasons.push(addressResult.exact ? 'Exact submitted address matches WCAD situs address' : 'Submitted address strongly matches WCAD situs address');
  }

  if (!reasons.length) {
    reasons.push('Broad search candidate only; identity not established');
    if (owner && returnedOwnerLabel) conflicts.push('Returned owner did not match the submitted owner or aliases');
  }
  return {
    matchLevel: level,
    matchScore: score,
    matchReasons: [...new Set(reasons)],
    matchConflicts: [...new Set(conflicts)],
    needsVerification: level === 'possible'
  };
}

function mergeResults(target, rows, query, criteria) {
  for (const raw of rows) {
    const key = resultKey(raw);
    const existing = target.get(key);
    const matchedQueries = unique([...(existing?.matchedQueries || []), query]);
    const classified = classifyPropertyResult(raw, criteria);
    const rank = { possible: 1, likely: 2, confirmed: 3 };
    const currentLevel = existing?.matchLevel || 'possible';
    const matchLevel = rank[classified.matchLevel] > rank[currentLevel] ? classified.matchLevel : currentLevel;
    target.set(key, {
      ...(existing || {}),
      ...raw,
      matchLevel,
      matchScore: Math.max(existing?.matchScore || 0, classified.matchScore),
      matchReasons: unique([...(existing?.matchReasons || []), ...classified.matchReasons]),
      matchConflicts: unique([...(existing?.matchConflicts || []), ...classified.matchConflicts]),
      needsVerification: matchLevel === 'possible',
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

  const paths = buildPropertySearchPaths({ owner, address, parcel, alternateNames });
  for (const path of paths.length ? paths : [{ term: '', strategy: 'empty_query' }]) {
    if (!multipathConfigs.length) break;
    const query = { ...baseQuery, owner: path.term, searchStrategy: path.strategy };
    const out = await runSourceGroup(multipathConfigs, () => query, { fetchImpl });
    mergeResults(results, out.results, path.term, { owner, address, parcel, alternateNames });
    evidence.push(...out.evidence);
  }

  return { results: [...results.values()], evidence };
}
