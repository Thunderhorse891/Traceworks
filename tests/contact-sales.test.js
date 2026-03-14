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
