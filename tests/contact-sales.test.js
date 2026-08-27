import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('enterprise sales remains available on its dedicated page', async () => {
  const html = await readFile('public/enterprise.html', 'utf8');
  assert.ok(html.includes('id="salesForm"'));
  assert.ok(html.includes('Send Message'));
  assert.ok(html.includes('type="email"'));
});

test('netlify routes contact-sales API endpoint', async () => {
  const toml = await readFile('netlify.toml', 'utf8');
  assert.ok(toml.includes('/api/contact-sales'));
});

test('netlify schedules queue worker', async () => {
  const toml = await readFile('netlify.toml', 'utf8');
  assert.ok(toml.includes('process-queue-cron'));
  assert.ok(toml.includes('*/2 * * * *'));
});

test('netlify defines a site-wide CSP and security headers for the static app', async () => {
  const toml = await readFile('netlify.toml', 'utf8');
  assert.ok(toml.includes('Content-Security-Policy'));
  assert.ok(toml.includes("default-src 'self'"));
  assert.ok(toml.includes("object-src 'none'"));
  assert.ok(toml.includes("frame-ancestors 'none'"));
  assert.ok(toml.includes('fonts.googleapis.com'));
  assert.ok(toml.includes('fonts.gstatic.com'));
});
