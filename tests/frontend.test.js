import test from 'node:test';
import assert from 'node:assert/strict';
import { clientPackages } from '../public/packages.js';

test('client packages include valid Stripe payment links', () => {
  assert.equal(clientPackages.length, 4);
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
});
