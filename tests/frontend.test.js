import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientPackages } from '../public/packages.js';

test('client packages include valid Stripe payment links', () => {
  assert.ok(clientPackages.length >= 4, `Expected at least 4 packages, got ${clientPackages.length}`);

  const paid = clientPackages.filter((p) => typeof p.payLink === 'string' && p.payLink.length > 0);

  assert.ok(paid.length >= 4, `Expected at least 4 paid packages, got ${paid.length}`);

  for (const pkg of clientPackages) {
    assert.ok(pkg.id);
    assert.ok(pkg.name);
    assert.ok(pkg.price.startsWith('$'));
    if (pkg.payLink !== null) assert.ok(pkg.payLink.startsWith('https://buy.stripe.com/'));
    assert.ok(Array.isArray(pkg.bullets) && pkg.bullets.length >= 3);
    assert.ok(typeof pkg.summary === 'string' && pkg.summary.length > 20);
    assert.equal('reportPreviewPath' in pkg, false);
    assert.ok(Array.isArray(pkg.includedFindings) && pkg.includedFindings.length >= 3);
    assert.ok(Array.isArray(pkg.intake?.requiredGroups) && pkg.intake.requiredGroups.length >= 2);
    assert.ok(Array.isArray(pkg.intake?.recommendedFields) && pkg.intake.recommendedFields.length >= 2);
  }

  for (const pkg of paid) {
    assert.ok(pkg.payLink.startsWith('https://buy.stripe.com/'), `Paid package ${pkg.id} payLink format unrecognized: ${pkg.payLink}`);
    assert.ok(pkg.price.startsWith('$'), `Paid package ${pkg.id} price should start with $`);
  }
});

test('homepage includes enterprise sales form', () => {
  const html = readFileSync('public/index.html', 'utf8');
  assert.ok(html.includes('salesForm'), 'homepage must include enterprise sales form');
  assert.ok(html.includes('name="requestedFindings"'));
  assert.ok(html.includes('name="lastKnownAddress"'));
  assert.ok(html.includes('id="packageModal"'));
  assert.ok(html.includes('id="liveBriefCard"'));
  assert.ok(html.includes('id="intakeProgressFill"'));
  assert.ok(html.includes('id="clearDraftBtn"'));
});

test('homepage keeps customer navigation on real production pages', () => {
  const html = readFileSync('public/index.html', 'utf8');
  assert.ok(html.includes('/packages.html'));
  assert.ok(html.includes('/order-status.html'));
  assert.equal(html.includes('/report-tiers.html'), false);
  assert.equal(html.includes('/console.html'), false);
  assert.equal(html.includes('/launch-readiness.html'), false);
});

test('retired sample preview page is explicit', () => {
  const html = readFileSync('public/report-tiers.html', 'utf8');
  assert.ok(html.includes('Sample previews were retired.'));
  assert.ok(html.includes('authenticated case links'));
});

test('order status tracker supports signed polling links', () => {
  const html = readFileSync('public/order-status.html', 'utf8');
  assert.ok(html.includes("params.set('status_token', currentStatusToken)"));
  assert.ok(html.includes('payment_confirmation_email_status'));
});

test('homepage app persists a structured local draft for intake continuity', () => {
  const js = readFileSync('public/app.js', 'utf8');
  assert.ok(js.includes('traceworksCheckoutDraftV1'));
  assert.ok(js.includes('localStorage.setItem'));
  assert.ok(js.includes('Local draft restored.'));
});
