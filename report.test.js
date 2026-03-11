import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('homepage links to launch readiness page', async () => {
  const html = await readFile('public/index.html', 'utf8');
  assert.ok(html.includes('/launch-readiness.html'));
});

test('launch readiness page includes health check hook', async () => {
  const html = await readFile('public/launch-readiness.html', 'utf8');
  assert.ok(html.includes('/api/health'));
  assert.ok(html.includes('What we need from you'));
  assert.ok(html.includes('GitHub push readiness'));
  assert.ok(html.includes('git remote add origin'));
});
