import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';

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

  assert.equal(pkg.scripts.test, 'node --test --test-isolation=none --test-concurrency=1');
  assert.equal(pkg.scripts.ci, 'npm run check');
  assert.ok(ciWorkflow.includes('npm ci'));
  assert.ok(ciWorkflow.includes('npm run ci'));
});

test('repo hygiene stays aligned with the Netlify-only production path', async () => {
  const readme = await readFile('README.md', 'utf8');
  const rootFiles = await readdir('.', { withFileTypes: true });
  const zipFiles = rootFiles.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.zip'));

  assert.ok(readme.includes('Netlify is the only supported deployment target'));
  assert.equal(readme.includes('<html'), false);
  assert.equal(await exists('vercel.json'), false);
  assert.equal(await exists('app.js'), false);
  assert.equal(zipFiles.length, 0);
});
