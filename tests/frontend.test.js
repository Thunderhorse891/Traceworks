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
  const js = readFileSync('public/order-status.js', 'utf8');
  assert.ok(js.includes("params.set('status_token', currentStatusToken)"));
  assert.ok(js.includes('payment_confirmation_email_status'));
  assert.ok(html.includes('id="briefPanel"'));
  assert.ok(html.includes('id="resRequestedFindings"'));
});

test('homepage app persists a structured local draft for intake continuity', () => {
  const js = readFileSync('public/app.js', 'utf8');
  assert.ok(js.includes('traceworksCheckoutDraftV1'));
  assert.ok(js.includes('localStorage.setItem'));
  assert.ok(js.includes('Local draft restored.'));
  assert.ok(js.includes("fetch('/api/packages')"));
  assert.ok(js.includes('Source Coverage Pending'));
});

test('success page surfaces stored intake brief details', () => {
  const html = readFileSync('public/success.html', 'utf8');
  assert.ok(html.includes('id="briefPanel"'));
  assert.ok(html.includes('id="fieldRequestedFindings"'));
  assert.ok(html.includes('id="briefSignalChips"'));
});

test('customer tracking pages use dedicated external modules instead of inline handlers', () => {
  const dashboard = readFileSync('public/dashboard.html', 'utf8');
  const tracker = readFileSync('public/order-status.html', 'utf8');
  const success = readFileSync('public/success.html', 'utf8');
  const offline = readFileSync('public/offline.html', 'utf8');

  assert.equal(dashboard.includes('onsubmit="lookupOrder(event)"'), false);
  assert.equal(dashboard.includes('onclick="clearHistory()"'), false);
  assert.ok(dashboard.includes('/dashboard.js'));
  assert.ok(dashboard.includes('role="alert"'));

  assert.equal(tracker.includes('onsubmit="lookupOrder(event)"'), false);
  assert.ok(tracker.includes('/order-status.js'));
  assert.ok(tracker.includes('role="alert"'));

  assert.ok(success.includes('/success.js'));
  assert.equal(success.includes("const params      = new URLSearchParams(location.search);"), false);

  assert.ok(offline.includes('/offline.js'));
});

test('packages catalog routes into the real intake flow and loads availability', () => {
  const html = readFileSync('public/packages.html', 'utf8');
  const js = readFileSync('public/package-availability.js', 'utf8');
  assert.ok(html.includes('/?packageId=standard#order'));
  assert.ok(html.includes('data-package-card'));
  assert.ok(html.includes('data-package-status'));
  assert.ok(html.includes('/package-availability.js'));
  assert.ok(js.includes("fetch('/api/packages')"));
  assert.ok(js.includes('Source Coverage Pending'));
});

test('admin dashboard exposes operator visibility panels for live launch monitoring', () => {
  const html = readFileSync('public/admin-dashboard.html', 'utf8');
  const js = readFileSync('public/admin-dashboard.js', 'utf8');
  assert.ok(html.includes('Manual Review Queue'));
  assert.ok(html.includes('Active Queue Work'));
  assert.ok(html.includes('Recent Audit Timeline'));
  assert.ok(html.includes('Dead Letters'));
  assert.ok(html.includes('manualReviewRows'));
  assert.ok(html.includes('activeJobRows'));
  assert.ok(html.includes('auditEventRows'));
  assert.ok(html.includes('deadLetterRows'));
  assert.ok(html.includes('Run Worker Once'));
  assert.ok(html.includes('opsFeedback'));
  assert.ok(html.includes('/admin-dashboard.js'));
  assert.equal(html.includes('onsubmit="authenticate(event)"'), false);
  assert.equal(html.includes('onclick="refresh()"'), false);
  assert.equal(html.includes('onclick="logout()"'), false);
  assert.ok(js.includes("data-admin-action=\"${escapeHtml(action)}\""));
});

test('manifest ships installable PNG icons and screenshots', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
  const pngIcons = manifest.icons.filter((icon) => icon.type === 'image/png');
  const purposes = new Set(pngIcons.map((icon) => icon.purpose));

  assert.ok(pngIcons.some((icon) => icon.src === '/icons/icon-192.png'));
  assert.ok(pngIcons.some((icon) => icon.src === '/icons/icon-512.png'));
  assert.ok(purposes.has('any'));
  assert.ok(purposes.has('maskable'));
  assert.ok(Array.isArray(manifest.screenshots) && manifest.screenshots.length >= 2);
});

test('public entry pages wire pwa bootstrap, metadata, and error handling consistently', () => {
  const pages = [
    'public/index.html',
    'public/packages.html',
    'public/enterprise.html',
    'public/contact-sales.html',
    'public/cancel.html',
    'public/terms.html',
    'public/privacy.html',
    'public/refund-policy.html',
  ];

  for (const file of pages) {
    const html = readFileSync(file, 'utf8');
    assert.ok(html.includes('<link rel="manifest" href="/manifest.json"'), `${file} should link the manifest`);
    assert.ok(html.includes('/favicon.svg'), `${file} should expose the favicon`);
    assert.ok(html.includes('/error-handler.js'), `${file} should load the shared error handler`);
    assert.ok(html.includes('/pwa.js') || file.endsWith('index.html') || file.endsWith('packages.html'), `${file} should load or already include the PWA bootstrap`);
  }
});

test('styled shell pages load premium fonts directly without CSS import bottlenecks', () => {
  const fontStylesheet = 'fonts.googleapis.com/css2?family=Inter';
  const preconnectGoogle = 'https://fonts.googleapis.com';
  const preconnectStatic = 'https://fonts.gstatic.com';
  const pages = [
    'public/admin-dashboard.html',
    'public/admin-orders.html',
    'public/cancel.html',
    'public/contact-sales.html',
    'public/dashboard.html',
    'public/enterprise.html',
    'public/index.html',
    'public/launch-readiness.html',
    'public/offline.html',
    'public/order-status.html',
    'public/packages.html',
    'public/privacy.html',
    'public/refund-policy.html',
    'public/report-sample.html',
    'public/report-tiers.html',
    'public/success.html',
    'public/terms.html',
  ];

  const sharedStyles = readFileSync('public/styles.css', 'utf8');
  assert.equal(sharedStyles.includes("@import url('https://fonts.googleapis.com/css2"), false);

  for (const file of pages) {
    const html = readFileSync(file, 'utf8');
    assert.ok(html.includes(preconnectGoogle), `${file} should preconnect to Google Fonts`);
    assert.ok(html.includes(preconnectStatic), `${file} should preconnect to Google static fonts`);
    assert.ok(html.includes(fontStylesheet), `${file} should load the shared font stylesheet directly`);
  }
});

test('key customer pages expose richer social metadata', () => {
  const pages = [
    'public/index.html',
    'public/packages.html',
    'public/enterprise.html',
    'public/contact-sales.html',
    'public/dashboard.html',
    'public/order-status.html',
    'public/success.html',
  ];

  for (const file of pages) {
    const html = readFileSync(file, 'utf8');
    assert.ok(html.includes('og:image'), `${file} should define og:image`);
    assert.ok(html.includes('twitter:card'), `${file} should define twitter:card`);
    assert.ok(html.includes('rel="canonical"'), `${file} should define a canonical link`);
  }
});

test('offline fallback removes inline retry handlers and loads shared recovery code', () => {
  const html = readFileSync('public/offline.html', 'utf8');
  assert.equal(html.includes('onclick="location.reload()"'), false);
  assert.ok(html.includes('retryConnectionBtn'));
  assert.ok(html.includes('/error-handler.js'));
  assert.ok(html.includes('/pwa.js'));
});

test('sales pages use external scripts instead of inline form handlers', () => {
  const contactSales = readFileSync('public/contact-sales.html', 'utf8');
  const enterprise = readFileSync('public/enterprise.html', 'utf8');

  assert.equal(contactSales.includes('onsubmit="submitForm(event)"'), false);
  assert.equal(enterprise.includes('onsubmit="submitSales(event)"'), false);
  assert.ok(contactSales.includes('/contact-sales.js'));
  assert.ok(enterprise.includes('/enterprise-sales.js'));
});

test('admin orders page removes inline artifact handlers', () => {
  const html = readFileSync('public/admin-orders.html', 'utf8');

  assert.ok(html.includes('/admin-orders.js'));
  assert.ok(html.includes('/error-handler.js'));
  assert.equal(html.includes("onclick='downloadArtifact"), false);
  assert.equal(html.includes('window.downloadArtifact'), false);
});

test('launch readiness page uses an external module instead of inline scripts', () => {
  const html = readFileSync('public/launch-readiness.html', 'utf8');
  const js = readFileSync('public/launch-readiness.js', 'utf8');

  assert.ok(html.includes('/launch-readiness.js'));
  assert.ok(html.includes('/error-handler.js'));
  assert.ok(js.includes('/api/health'));
  assert.ok(js.includes('/api/launch-audit'));
  assert.ok(js.includes('/api/source-proof'));
  assert.ok(js.includes('/api/admin-login'));
});
