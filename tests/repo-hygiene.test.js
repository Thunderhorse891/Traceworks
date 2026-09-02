import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test('repo ships GitHub Actions CI and stable local verification scripts', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const ciWorkflow = await readFile('.github/workflows/ci.yml', 'utf8');

  assert.equal(pkg.scripts.test, 'node --test --test-concurrency=1');
  assert.equal(pkg.scripts.ci, 'npm run check');
  assert.ok(ciWorkflow.includes('npm ci'));
  assert.ok(ciWorkflow.includes('npm run ci'));
});

test('repo hygiene keeps Netlify rollback support and adds an explicit Vercel path', async () => {
  const readme = await readFile('README.md', 'utf8');
  const rootFiles = await readdir('.', { withFileTypes: true });
  const zipFiles = rootFiles.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.zip'));

  assert.ok(readme.includes('Vercel is the primary deployment target'));
  assert.equal(readme.includes('<html'), false);
  assert.equal(await exists('vercel.json'), true);
  assert.equal(await exists('api/[name].js'), true);
  assert.equal(await exists('app.js'), false);
  assert.equal(zipFiles.length, 0);
  assert.equal(await exists('public/robots.txt'), true);
  assert.equal(await exists('public/favicon.svg'), true);
  assert.equal(await exists('public/error-handler.js'), true);
  assert.equal((await readFile('public/styles.css', 'utf8')).includes("@import url('https://fonts.googleapis.com/css2"), false);
});

test('Vercel config preserves static output, API cron, and security headers', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  const dispatcher = await readFile('api/[name].js', 'utf8');
  const cron = await readFile('netlify/functions/process-queue-scheduled.js', 'utf8');

  assert.equal(config.framework, null);
  assert.equal(config.outputDirectory, 'public');
  assert.ok(config.crons.some((entry) => entry.path === '/api/process-queue-cron'));
  assert.ok(config.crons.every((entry) => entry.schedule === '0 8 * * *'));
  assert.ok(config.headers[0].headers.some((entry) => entry.key === 'Content-Security-Policy'));
  assert.ok(dispatcher.includes("'stripe-webhook': stripeWebhook"));
  assert.ok(dispatcher.includes("'process-queue-cron': processQueueScheduled"));
  assert.ok(dispatcher.includes("new URL(request.url, 'https://traceworks.invalid')"));
  assert.ok(cron.includes('authorization === `Bearer ${secret}`'));
});

test('Netlify hardens key customer pages with stricter script CSP where inline JS is no longer needed', async () => {
  const netlifyToml = await readFile('netlify.toml', 'utf8');

  assert.ok(netlifyToml.includes("script-src 'self';"));
  assert.equal(netlifyToml.includes("script-src 'self' 'unsafe-inline'"), false);
});

test('Netlify function entrypoints use the modern adapter or return native Responses', async () => {
  const entrypoints = await readdir('netlify/functions', { withFileTypes: true });

  for (const entry of entrypoints) {
    if (!entry.isFile() || path.extname(entry.name) !== '.js') continue;

    const filePath = path.join('netlify/functions', entry.name);
    const source = await readFile(filePath, 'utf8');
    const usesModernAdapter = source.includes("createModernHandler") && source.includes('export default createModernHandler(');
    const returnsNativeResponse = source.includes('return new Response(');

    assert.equal(
      usesModernAdapter || returnsNativeResponse,
      true,
      `${filePath} must use createModernHandler() or return a native Response from its default export.`
    );
  }
});
