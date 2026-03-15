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

function absoluteUrl(base, path) {
  return new URL(path, base).toString();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function requestText(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  return { response, body };
}

const args = parseArgs(process.argv.slice(2));
const baseUrl = String(args.url || process.env.URL || '').trim();
const adminKey = String(args['admin-key'] || process.env.ADMIN_API_KEY || '').trim();

if (!baseUrl) {
  console.error('Usage: node scripts/live-smoke.mjs --url https://your-site.example [--admin-key your-admin-key]');
  process.exit(1);
}

const checks = [];

async function runCheck(label, fn) {
  try {
    await fn();
    checks.push({ label, ok: true });
  } catch (error) {
    checks.push({ label, ok: false, error: String(error?.message || error) });
  }
}

await runCheck('Homepage responds', async () => {
  const { response, body } = await requestText(absoluteUrl(baseUrl, '/'));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!body.includes('TraceWorks')) throw new Error('Homepage did not include TraceWorks branding.');
});

await runCheck('Packages page responds', async () => {
  const { response, body } = await requestText(absoluteUrl(baseUrl, '/packages.html'));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!body.includes('Six tiers.')) throw new Error('Packages page did not render expected catalog copy.');
});

await runCheck('Public health responds', async () => {
  const { response, body } = await requestJson(absoluteUrl(baseUrl, '/api/health'));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!body.service || body.service !== 'traceworks') throw new Error('Health endpoint did not identify traceworks service.');
});

await runCheck('Package catalog includes launch readiness', async () => {
  const { response, body } = await requestJson(absoluteUrl(baseUrl, '/api/packages'));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const packages = Array.isArray(body.packages) ? body.packages : [];
  if (!packages.length) throw new Error('No packages returned.');
  if (!packages.every((pkg) => Object.prototype.hasOwnProperty.call(pkg, 'launchReady'))) {
    throw new Error('Package launch readiness fields are missing.');
  }
  if (!packages.some((pkg) => pkg.launchReady === true)) {
    throw new Error('No packages are launch-ready in the live environment.');
  }
});

if (adminKey) {
  await runCheck('Admin launch audit responds', async () => {
    const { response, body } = await requestJson(absoluteUrl(baseUrl, '/api/launch-audit'), {
      headers: { Authorization: `Bearer ${adminKey}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!Array.isArray(body.checks)) throw new Error('Launch audit checks missing.');
  });

  await runCheck('Admin health exposes diagnostics', async () => {
    const { response, body } = await requestJson(absoluteUrl(baseUrl, '/api/health'), {
      headers: { Authorization: `Bearer ${adminKey}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (body.visibility !== 'admin') throw new Error('Admin health did not return admin visibility.');
  });
}

const failures = checks.filter((check) => !check.ok);
console.log(`TraceWorks live smoke: ${failures.length ? 'FAILED' : 'PASS'}`);
for (const check of checks) {
  console.log(`- ${check.ok ? 'PASS' : 'FAIL'} ${check.label}${check.error ? ` :: ${check.error}` : ''}`);
}

if (failures.length) {
  process.exitCode = 1;
}
