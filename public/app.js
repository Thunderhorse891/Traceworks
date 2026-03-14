import { clientPackages } from './packages.js';

const packagesGrid = document.getElementById('packages-grid');
const packageInput = document.getElementById('packageId');
const statusEl = document.getElementById('status');
const salesStatus = document.getElementById('salesStatus');
const subjectTypeInput = document.getElementById('subjectType');
const packageSelectionHelp = document.getElementById('packageSelectionHelp');
const intakeGuidance = document.getElementById('intakeGuidance');
const selectedPackageSummary = document.getElementById('selectedPackageSummary');
const selectedPackageName = document.getElementById('selectedPackageName');
const selectedPackageTurnaround = document.getElementById('selectedPackageTurnaround');
const selectedPackageGuidance = document.getElementById('selectedPackageGuidance');

const packageModal = document.getElementById('packageModal');
const packageModalClose = document.getElementById('packageModalClose');
const packageModalSelect = document.getElementById('packageModalSelect');
const packageModalLabel = document.getElementById('packageModalLabel');
const packageModalName = document.getElementById('packageModalName');
const packageModalPrice = document.getElementById('packageModalPrice');
const packageModalSummary = document.getElementById('packageModalSummary');
const packageModalIncluded = document.getElementById('packageModalIncluded');
const packageModalWorkflow = document.getElementById('packageModalWorkflow');
const packageModalRequired = document.getElementById('packageModalRequired');
const packageModalRecommended = document.getElementById('packageModalRecommended');
const packageModalGuidance = document.getElementById('packageModalGuidance');

const intakeFieldWrappers = new Map(
  [...document.querySelectorAll('[data-intake-field]')].map((el) => [el.dataset.intakeField, el])
);

let activeModalPackage = null;

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

function setList(target, items = []) {
  if (!target) return;
  target.innerHTML = items.map((item) => `<li>${item}</li>`).join('');
}

function setFieldVisibility(fieldName, visible) {
  const wrapper = intakeFieldWrappers.get(fieldName);
  if (!wrapper) return;
  wrapper.hidden = !visible;
  wrapper.querySelectorAll('input, textarea, select').forEach((input) => {
    input.disabled = !visible;
  });
}

function applyPackageToForm(pkg) {
  if (packageInput) packageInput.value = pkg.id;
  if (subjectTypeInput && pkg.intake?.defaultSubjectType) subjectTypeInput.value = pkg.intake.defaultSubjectType;

  const visibleFields = new Set(pkg.intake?.fields || []);
  for (const fieldName of intakeFieldWrappers.keys()) {
    setFieldVisibility(fieldName, visibleFields.has(fieldName));
  }

  if (selectedPackageSummary) selectedPackageSummary.hidden = false;
  if (selectedPackageName) selectedPackageName.textContent = pkg.name;
  if (selectedPackageTurnaround) selectedPackageTurnaround.textContent = `${pkg.turnaround} · ${pkg.price}`;
  if (selectedPackageGuidance) selectedPackageGuidance.textContent = pkg.intake?.guidance || pkg.summary || '';
  if (packageSelectionHelp) {
    packageSelectionHelp.textContent = `Required: ${(pkg.intake?.requiredSignals || []).join(' · ')}. Recommended: ${(pkg.intake?.recommendedSignals || []).join(' · ')}.`;
  }
  if (intakeGuidance) {
    intakeGuidance.textContent = pkg.intake?.guidance || 'More identifiers improve match quality and reduce manual review.';
  }
}

async function selectPackage(pkg, { shouldScroll = true, source = 'grid' } = {}) {
  document.querySelectorAll('[data-package-id]').forEach((card) => card.classList.remove('selected'));
  const card = document.querySelector(`[data-package-id="${pkg.id}"]`);
  card?.classList.add('selected');

  applyPackageToForm(pkg);

  if (statusEl) statusEl.textContent = `${pkg.name} selected. Complete the structured intake below so the workflow starts with the strongest identifiers.`;

  if (shouldScroll) {
    document.getElementById('order')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  await track(source === 'prefill' ? 'package_prefilled' : 'package_selected', pkg.id);
}

function fillPackageModal(pkg) {
  if (!pkg) return;
  activeModalPackage = pkg;
  if (packageModalLabel) packageModalLabel.textContent = pkg.id.replaceAll('_', ' ').toUpperCase();
  if (packageModalName) packageModalName.textContent = pkg.name;
  if (packageModalPrice) packageModalPrice.textContent = pkg.price;
  if (packageModalSummary) packageModalSummary.textContent = pkg.summary || '';
  if (packageModalGuidance) packageModalGuidance.textContent = pkg.intake?.guidance || '';
  setList(packageModalIncluded, pkg.includedFindings || []);
  setList(packageModalWorkflow, pkg.workflowScope || pkg.bullets || []);
  setList(packageModalRequired, pkg.intake?.requiredSignals || []);
  setList(packageModalRecommended, pkg.intake?.recommendedSignals || []);
}

function openPackageModal(pkg) {
  if (!packageModal) return;
  fillPackageModal(pkg);
  if (typeof packageModal.showModal === 'function') {
    packageModal.showModal();
  } else {
    packageModal.setAttribute('open', 'open');
  }
}

function closePackageModal() {
  if (!packageModal) return;
  if (typeof packageModal.close === 'function') packageModal.close();
  else packageModal.removeAttribute('open');
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
      <button type="button" class="btn-outline package-detail-btn">View Scope</button>
      <button type="button" class="select-btn">Start Intake</button>
    </div>
  `;

  el.querySelector('.package-detail-btn')?.addEventListener('click', async () => {
    openPackageModal(pkg);
    await track('package_detail_opened', pkg.id);
  });

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

packageModalClose?.addEventListener('click', closePackageModal);
packageModal?.addEventListener('click', (event) => {
  if (event.target === packageModal) closePackageModal();
});
packageModalSelect?.addEventListener('click', async () => {
  if (!activeModalPackage) return;
  closePackageModal();
  await selectPackage(activeModalPackage, { source: 'modal' });
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
