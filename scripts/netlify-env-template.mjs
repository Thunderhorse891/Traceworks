import { buildNetlifyEnvTemplate, formatSourceEndpointContracts } from './_lib/launch-kit.mjs';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith('--')) continue;
    out[key.slice(2)] = value && !value.startsWith('--') ? value : 'true';
    if (value && !value.startsWith('--')) i += 1;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

const template = buildNetlifyEnvTemplate({
  siteUrl: args.url || process.env.URL || 'https://traceworks.example.com',
  ownerEmail: args['owner-email'] || process.env.OWNER_EMAIL || 'traceworks.tx@outlook.com',
  emailFrom: args['email-from'] || process.env.EMAIL_FROM || args['owner-email'] || process.env.OWNER_EMAIL || 'traceworks.tx@outlook.com'
});

console.log(template);
console.log('');
console.log('# Source endpoint contracts');
for (const line of formatSourceEndpointContracts()) {
  console.log(`# ${line}`);
}
