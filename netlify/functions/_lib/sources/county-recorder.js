import { runSourceGroup } from './source-runner.js';

export async function searchCountyRecorder({ county, state, owner, address, parcel, configs = [], fetchImpl = fetch }) {
  return runSourceGroup(
    configs,
    () => ({ county: county || '', state: state || '', owner: owner || '', address: address || '', parcel: parcel || '' }),
    { fetchImpl }
  );
}
