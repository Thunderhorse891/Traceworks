import { runSourceGroup } from './source-runner.js';

export async function searchProbateIndex({ decedent, county, state, configs = [], fetchImpl = fetch }) {
  return runSourceGroup(
    configs,
    () => ({ decedent: decedent || '', county: county || '', state: state || '' }),
    { fetchImpl }
  );
}
