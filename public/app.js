import { clientPackages } from './packages.js';

const cards = document.getElementById('packageCards');
const heirCards = document.getElementById('heirPackageCards');
const packageInput = document.getElementById('packageId');
const statusEl = document.getElementById('status');
const packageModal = document.getElementById('packageModal');
const modalCloseButton = document.getElementById('packageModalClose');
const modalSelectButton = document.getElementById('modalSelectPackage');

const modalFields = {
  label: document.getElementById('modalPackageLabel'),
  title: document.getElementById('modalPackageTitle'),
  price: document.getElementById('modalPackagePrice'),
  summary: document.getElementById('modalPackageSummary'),
  includes: document.getElementById('modalPackageIncludes'),
  previewLink: document.getElementById('modalReportPreview')
};

let activePackage = null;

async function track(type, detail = '') {
  try {
    await fetch('/api/track-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, packageId: packageInput.value, page: 'home', detail })
    });
  } catch {}
}

for (const pkg of clientPackages) {
  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `
    <p class="label">${pkg.id.toUpperCase()}</p>
    ${pkg.featured ? '<p class="feature-badge">Most Selected</p>' : ''}
    <h4>${pkg.name}</h4>
    <p class="price">${pkg.price}</p>
    <p class="pkg-meta"><strong>Best for:</strong> ${pkg.bestFor || 'Legal locate intelligence workflows'}</p>
    <p class="pkg-turnaround">${pkg.turnaround || 'Typical delivery: same day to 24h'}</p>
    <ul>${pkg.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
    <button type="button" class="details-btn">View Package Details</button>
    <button type="button" class="select-btn">Select Package</button>
    <a class="pay-link" href="${pkg.payLink}" target="_blank" rel="noopener">Open Stripe Payment Link →</a>
  `;

  const detailsButton = el.querySelector('.details-btn');
  const selectButton = el.querySelector('.select-btn');

  selectButton.addEventListener('click', async () => {
    document.querySelectorAll('.card').forEach((c) => c.classList.remove('selected'));
    el.classList.add('selected');
    packageInput.value = pkg.id;
    statusEl.textContent = `${pkg.name} selected. Use Stripe Payment Link or continue with secure intake checkout.`;
    await track('package_selected', pkg.id);
  });

  detailsButton.addEventListener('click', async () => {
    openPackageModal(pkg);
    await track('package_details_opened', pkg.id);
  });

  el.querySelector('.pay-link').addEventListener('click', async () => {
    packageInput.value = pkg.id;
    await track('payment_link_clicked', pkg.id);
  });

if (pkg.id === 'heir' && heirCards) heirCards.appendChild(el);
  else cards.appendChild(el);
}

function openPackageModal(pkg) {
  if (!packageModal) return;
  activePackage = pkg;
  modalFields.label.textContent = pkg.id.toUpperCase();
  modalFields.title.textContent = pkg.name;
  modalFields.price.textContent = pkg.price;
  modalFields.summary.textContent = pkg.summary || 'Detailed package scope is shown below.';
  modalFields.includes.innerHTML = (pkg.previewIncludes || pkg.bullets || []).map((item) => `<li>${item}</li>`).join('');
  modalFields.previewLink.href = pkg.reportPreviewPath || '/report-tiers.html';
  modalFields.previewLink.textContent = `Open ${pkg.name} sample report`;
  packageModal.showModal();
}

function closePackageModal() {
  if (packageModal?.open) packageModal.close();
}

modalCloseButton?.addEventListener('click', closePackageModal);

packageModal?.addEventListener('click', (event) => {
  if (event.target === packageModal) closePackageModal();
});

modalSelectButton?.addEventListener('click', async () => {
  if (!activePackage) return;
  const selectedCard = [...document.querySelectorAll('.card')].find((card) => card.querySelector('.label')?.textContent === activePackage.id.toUpperCase());
  document.querySelectorAll('.card').forEach((c) => c.classList.remove('selected'));
  selectedCard?.classList.add('selected');
  packageInput.value = activePackage.id;
  statusEl.textContent = `${activePackage.name} selected from package details. Continue to secure intake checkout.`;
  closePackageModal();
  await track('package_selected_from_modal', activePackage.id);
});

function checked(form, name) {
  return form.querySelector(`[name="${name}"]`)?.checked === true;
}

document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

  if (!packageInput.value) {
    statusEl.textContent = 'Please select a service package before checkout.';
    await track('checkout_blocked', 'missing_package');
    return;
  }

  if (!checked(form, 'legalConsent') || !checked(form, 'tosConsent')) {
    statusEl.textContent = 'Please accept legal use and terms before checkout.';
    await track('checkout_blocked', 'missing_consents');
    return;
  }

  statusEl.textContent = 'Creating secure checkout...';
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.legalConsent = checked(form, 'legalConsent');
  payload.tosConsent = checked(form, 'tosConsent');

  await track('checkout_started');
  const response = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    statusEl.textContent = data.error || 'Unable to start checkout.';
    await track('checkout_error', statusEl.textContent);
    return;
  }
  await track('checkout_redirect', data.caseRef || '');
  window.location.href = data.checkoutUrl;
});


const salesForm = document.getElementById('salesForm');
const salesStatus = document.getElementById('salesStatus');

if (salesForm && salesStatus) {
  salesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    salesStatus.textContent = 'Submitting enterprise inquiry...';
    const payload = Object.fromEntries(new FormData(salesForm).entries());

    const res = await fetch('/api/contact-sales', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      salesStatus.textContent = data.error || 'Unable to submit inquiry right now.';
      await track('sales_lead_error', salesStatus.textContent);
      return;
    }

    salesStatus.textContent = 'Received. We will contact you from traceworks.tx@outlook.com.';
    salesForm.reset();
    await track('sales_lead_submitted', payload.monthlyCases || '');
  });
}
