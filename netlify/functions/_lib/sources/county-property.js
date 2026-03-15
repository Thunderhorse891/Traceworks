import { runSourceGroup } from './source-runner.js';

export async function searchCountyProperty({ county, state, address, owner, parcel, configs = [], fetchImpl = fetch }) {
  return runSourceGroup(
    configs,
    () => ({ county: county || '', state: state || '', address: address || '', owner: owner || '', parcel: parcel || '' }),
    { fetchImpl }
  );
}
