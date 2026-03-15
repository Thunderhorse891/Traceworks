import { generateLaunchSecrets } from './_lib/launch-kit.mjs';

const secrets = generateLaunchSecrets();

console.log('# TraceWorks runtime secrets');
for (const [key, value] of Object.entries(secrets)) {
  console.log(`${key}=${value}`);
}
