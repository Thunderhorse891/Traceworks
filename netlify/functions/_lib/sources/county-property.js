import { runConfiguredSource } from '../adapters/registry.js';

export async function searchCountyProperty({ address, owner, parcel, configs = [], fetchImpl = fetch }) {
  const allResults = [];
  const evidence = [];

  for (const config of configs) {
    const query = { address: address || '', owner: owner || '', parcel: parcel || '' };
    const out = await runConfiguredSource(config, query, { fetchImpl });
    allResults.push(...out.results);
    evidence.push(out.evidence);
  }

  return { results: allResults, evidence };
}
