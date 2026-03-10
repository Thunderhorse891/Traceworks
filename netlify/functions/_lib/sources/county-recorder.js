import { runSourceGroup } from './source-runner.js';

export async function searchCountyRecorder({ owner, address, parcel, configs = [], fetchImpl = fetch }) {
  return runSourceGroup(
    configs,
    () => ({ owner: owner || '', address: address || '', parcel: parcel || '' }),
    { fetchImpl }
  );
}
