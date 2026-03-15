import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('homepage includes enterprise sales form', async () => {
  const html = await readFile('public/index.html', 'utf8');
  assert.ok(html.includes('id="salesForm"'));
  assert.ok(html.includes('Request Enterprise Call'));
  assert.ok(html.includes('name="website"'));
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
