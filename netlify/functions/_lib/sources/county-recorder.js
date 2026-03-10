import { runConfiguredSource } from '../adapters/registry.js';

export async function searchCountyRecorder({ owner, address, parcel, configs = [], fetchImpl = fetch }) {
  const allResults = [];
  const evidence = [];

  for (const config of configs) {
    const query = { owner: owner || '', address: address || '', parcel: parcel || '' };
    const out = await runConfiguredSource(config, query, { fetchImpl });
    allResults.push(...out.results);
    evidence.push(out.evidence);
  }

  return { results: allResults, evidence };
}
