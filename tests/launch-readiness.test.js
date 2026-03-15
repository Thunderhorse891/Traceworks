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
  assert.ok(html.includes('Phase One Launch Rules'));
  assert.ok(html.includes('Manual Verification Still Required'));
  assert.ok(html.includes('Paid checkout stays off until the launch audit has zero blockers'));
  assert.ok(html.includes('Durable storage is non-negotiable'));
  assert.ok(html.includes('Live Proof Still Required Today'));
  assert.ok(html.includes('Real end-to-end launch rehearsal'));
  assert.ok(html.includes('County and provider validation'));
  assert.ok(html.includes('Package Launch Matrix'));
});
