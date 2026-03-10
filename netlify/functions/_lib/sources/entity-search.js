import { runSourceGroup } from './source-runner.js';

export async function searchEntityRegistry({ entityName, configs = [], fetchImpl = fetch }) {
  return runSourceGroup(
    configs,
    () => ({ entityName: entityName || '' }),
    { fetchImpl }
  );
}
