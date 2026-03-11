import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientPackages } from '../public/packages.js';

test('client packages include valid Stripe payment links', () => {
  assert.ok(clientPackages.length >= 5, `Expected at least 5 packages, got ${clientPackages.length}`);

  const paid   = clientPackages.filter((p) => p.payLink !== null);
  const custom = clientPackages.filter((p) => p.payLink === null);

  assert.ok(paid.length   >= 4, `Expected at least 4 paid packages, got ${paid.length}`);
  assert.ok(custom.length >= 1, `Expected at least 1 contact/custom package`);

  for (const pkg of clientPackages) {
    assert.ok(pkg.id);
    assert.ok(pkg.name);
    assert.ok(pkg.price.startsWith('$'));
    assert.ok(pkg.payLink.startsWith('https://buy.stripe.com/'));
    assert.ok(Array.isArray(pkg.bullets) && pkg.bullets.length >= 3);
    assert.ok(pkg.reportPreviewPath.startsWith('/reports/'));
    assert.ok(typeof pkg.summary === 'string' && pkg.summary.length > 20);
    assert.ok(Array.isArray(pkg.previewIncludes) && pkg.previewIncludes.length >= 3);
  }

  for (const pkg of paid) {
    assert.ok(
      pkg.payLink.startsWith('https://buy.stripe.com/') || pkg.payLink.includes('REPLACE_'),
      `Paid package ${pkg.id} payLink format unrecognized: ${pkg.payLink}`
    );
    assert.ok(pkg.price.startsWith('$'), `Paid package ${pkg.id} price should start with $`);
  }
});

test('homepage includes enterprise sales form', () => {
  const html = readFileSync('public/index.html', 'utf8');
  assert.ok(html.includes('salesForm'), 'homepage must include enterprise sales form');
});

test('homepage links to launch readiness page', () => {
  const html = readFileSync('public/index.html', 'utf8');
  assert.ok(html.includes('launch-readiness.html'), 'homepage must link to launch-readiness.html');
});

test('launch readiness page includes health check hook', () => {
  const html = readFileSync('public/launch-readiness.html', 'utf8');
  assert.ok(html.includes('/api/health'), 'launch-readiness.html must call /api/health');
});
