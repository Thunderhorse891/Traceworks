import { runSourceGroup } from './source-runner.js';

export async function searchCountyProperty({ address, owner, parcel, configs = [], fetchImpl = fetch }) {
  return runSourceGroup(
    configs,
    () => ({ address: address || '', owner: owner || '', parcel: parcel || '' }),
    { fetchImpl }
  );
}
