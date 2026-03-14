import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const requiredPages = [
  'public/console.html',
  'public/cases.html',
  'public/reports.html',
  'public/sources.html',
  'public/workflows.html',
  'public/billing.html',
];

test('intelligence console multipage shell exists', () => {
  for (const page of requiredPages) {
    const html = readFileSync(page, 'utf8');
    assert.ok(html.includes('tw-shell'), `Expected tw-shell class in ${page}`);
  }
});

test('operator shell navigation only advertises live-backed pages', () => {
  const html = readFileSync('public/console.html', 'utf8');
  assert.equal(html.includes('/search.html'), false);
  assert.equal(html.includes('/admin.html'), false);
  assert.ok(html.includes('/admin-dashboard.html'));
});

test('retired operator mock pages are explicit', () => {
  const searchHtml = readFileSync('public/search.html', 'utf8');
  const adminHtml = readFileSync('public/admin.html', 'utf8');
  assert.ok(searchHtml.includes('Unified Search Removed'));
  assert.ok(adminHtml.includes('Static Admin Shell Removed'));
});
