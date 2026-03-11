import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const requiredPages = [
  'public/console.html',
  'public/cases.html',
  'public/search.html',
  'public/reports.html',
  'public/sources.html',
  'public/workflows.html',
  'public/billing.html',
  'public/admin.html',
];

test('intelligence console multipage shell exists', () => {
  for (const page of requiredPages) {
    const html = readFileSync(page, 'utf8');
    assert.ok(html.includes('Traceworks Console'));
  }
});

test('homepage links to intelligence console', () => {
  const html = readFileSync('public/index.html', 'utf8');
  assert.ok(html.includes('/console.html'));
});
