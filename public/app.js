import { clientPackages } from './packages.js';

const packagesGrid = document.getElementById('packages-grid');
const packageInput = document.getElementById('packageId');
const statusEl = document.getElementById('status');
const salesStatus = document.getElementById('salesStatus');

async function track(type, detail = '') {
  try {
    await fetch('/api/track-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, packageId: packageInput?.value || '', page: 'home', detail })
    });
  } catch {}
}

function selectedCard() {
  return document.querySelector('[data-package-id].selected');
}

async function selectPackage(pkg, { shouldScroll = true, source = 'grid' } = {}) {
  document.querySelectorAll('[data-package-id]').forEach((card) => card.classList.remove('selected'));
  const card = document.querySelector(`[data-package-id="${pkg.id}"]`);
  card?.classList.add('selected');

  if (packageInput) packageInput.value = pkg.id;
  if (statusEl) statusEl.textContent = `${pkg.name} selected. Complete the secure intake form below.`;

  if (shouldScroll) {
    document.getElementById('order')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  await track(source === 'prefill' ? 'package_prefilled' : 'package_selected', pkg.id);
}

function buildCard(pkg) {
  const el = document.createElement('article');
  el.className = 'card';
  el.dataset.packageId = pkg.id;
  el.innerHTML = `
    <p class="label">${pkg.id.replaceAll('_', ' ').toUpperCase()}</p>
    ${pkg.featured ? '<p class="feature-badge">Most Selected</p>' : ''}
    <h4>${pkg.name}</h4>
    <p class="price">${pkg.price}</p>
    <p class="pkg-meta"><strong>Best for:</strong> ${pkg.bestFor || 'Legal locate intelligence workflows'}</p>
    <p class="pkg-meta">${pkg.summary || ''}</p>
    <p class="pkg-turnaround">${pkg.turnaround || 'Typical delivery: same day to 24h'}</p>
    <ul>${pkg.bullets.map((item) => `<li>${item}</li>`).join('')}</ul>
    <div class="card-actions">
      <button type="button" class="select-btn">Select Package</button>
    </div>
  `;

  el.querySelector('.select-btn')?.addEventListener('click', async () => {
    await selectPackage(pkg, { source: 'grid' });
  });

  return el;
}

function renderPackages() {
  if (!packagesGrid) return;
  packagesGrid.innerHTML = '';
  for (const pkg of clientPackages) {
    packagesGrid.appendChild(buildCard(pkg));
  }
}

function checked(form, name) {
  return form.querySelector(`[name="${name}"]`)?.checked === true;
}

document.getElementById('checkoutForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;

  if (!packageInput?.value) {
    if (statusEl) statusEl.textContent = 'Please select a report tier above before checkout.';
    await track('checkout_blocked', 'missing_package');
    return;
  }

  if (!checked(form, 'legalConsent') || !checked(form, 'tosConsent')) {
    if (statusEl) statusEl.textContent = 'Please confirm legal use and accept terms before checkout.';
    await track('checkout_blocked', 'missing_consents');
    return;
  }

  if (statusEl) statusEl.textContent = 'Creating secure checkout session...';
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.legalConsent = checked(form, 'legalConsent');
  payload.tosConsent = checked(form, 'tosConsent');

  await track('checkout_started');

  let response;
  let data;
  try {
    response = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    data = await response.json();
  } catch {
    if (statusEl) statusEl.textContent = 'Network error. Please check your connection and try again.';
    await track('checkout_error', 'network_failure');
    return;
  }

  if (!response.ok) {
    if (statusEl) statusEl.textContent = data.error || 'Unable to start checkout.';
    await track('checkout_error', data.error || 'unknown');
    return;
  }

  await track('checkout_redirect', data.caseRef || '');
  window.location.href = data.checkoutUrl;
});

document.getElementById('salesForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  if (salesStatus) salesStatus.textContent = 'Submitting inquiry...';

  const payload = Object.fromEntries(new FormData(form).entries());
  let response;
  let data;
  try {
    response = await fetch('/api/contact-sales', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    data = await response.json();
  } catch {
    if (salesStatus) salesStatus.textContent = 'Network error. Please try again.';
    await track('sales_lead_error', 'network_failure');
    return;
  }

  if (!response.ok) {
    if (salesStatus) salesStatus.textContent = data.error || 'Unable to submit inquiry right now.';
    await track('sales_lead_error', data.error || 'unknown');
    return;
  }

  if (salesStatus) salesStatus.textContent = 'Received. We will be in touch from traceworks.tx@outlook.com.';
  form.reset();
  await track('sales_lead_submitted', payload.monthlyCases || '');
});

renderPackages();

const requestedPackageId = new URLSearchParams(window.location.search).get('packageId');
if (requestedPackageId) {
  const pkg = clientPackages.find((item) => item.id === requestedPackageId);
  if (pkg) selectPackage(pkg, { shouldScroll: false, source: 'prefill' });
}

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

if (selectedCard() && statusEl && !statusEl.textContent) {
  statusEl.textContent = 'Package selected. Complete the secure intake form below.';
}
