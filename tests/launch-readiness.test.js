import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('admin dashboard links to launch readiness page', async () => {
  const html = await readFile('public/admin-dashboard.html', 'utf8');
  assert.ok(html.includes('/launch-readiness.html'));
});

test('launch readiness page includes health check hook', async () => {
  const html = await readFile('public/launch-readiness.html', 'utf8');
  assert.ok(html.includes('/api/health'));
  assert.ok(html.includes('/api/launch-audit'));
  assert.ok(html.includes('What we need from you'));
  assert.ok(html.includes('Manual Verification Still Required'));
  assert.ok(html.includes('REST KV Storage Connected'));
  assert.ok(html.includes('Netlify Scheduled Worker Active'));
  assert.ok(html.includes('Stripe live checkout verification'));
  assert.ok(html.includes('GitHub push readiness'));
  assert.ok(html.includes('git remote add origin'));
});
