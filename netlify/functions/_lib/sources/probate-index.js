import { runConfiguredSource } from '../adapters/registry.js';

export async function searchProbateIndex({ decedent, county, state, configs = [], fetchImpl = fetch }) {
  const allResults = [];
  const evidence = [];

  for (const config of configs) {
    const query = { decedent: decedent || '', county: county || '', state: state || '' };
    const out = await runConfiguredSource(config, query, { fetchImpl });
    allResults.push(...out.results);
    evidence.push(out.evidence);
  }

  return { results: allResults, evidence };
}
