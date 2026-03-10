import { runConfiguredSource } from '../adapters/registry.js';

export async function searchEntityRegistry({ entityName, configs = [], fetchImpl = fetch }) {
  const allResults = [];
  const evidence = [];

  for (const config of configs) {
    const query = { entityName: entityName || '' };
    const out = await runConfiguredSource(config, query, { fetchImpl });
    allResults.push(...out.results);
    evidence.push(out.evidence);
  }

  return { results: allResults, evidence };
}
