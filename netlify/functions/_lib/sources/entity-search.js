import { runSourceGroup } from './source-runner.js';

export async function searchEntityRegistry({ entityName, state, configs = [], fetchImpl = fetch }) {
  return runSourceGroup(
    configs,
    () => ({ entityName: entityName || '', state: state || '' }),
    { fetchImpl }
  );
}
