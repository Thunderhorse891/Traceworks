import { clientPackages } from './packages.js';

const cards = document.getElementById('packageCards');
const packageInput = document.getElementById('packageId');
const statusEl = document.getElementById('status');

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
    <h4>${pkg.name}</h4>
    <p class="price">${pkg.price}</p>
    <ul>${pkg.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
    <button type="button">Select Package</button>
    <a class="pay-link" href="${pkg.payLink}" target="_blank" rel="noopener">Open Stripe Payment Link →</a>
  `;

  el.querySelector('button').addEventListener('click', async () => {
    document.querySelectorAll('.card').forEach((c) => c.classList.remove('selected'));
    el.classList.add('selected');
    packageInput.value = pkg.id;
    statusEl.textContent = `${pkg.name} selected. Use Stripe Payment Link or continue with secure intake checkout.`;
    await track('package_selected', pkg.id);
  });

  el.querySelector('.pay-link').addEventListener('click', async () => {
    packageInput.value = pkg.id;
    await track('payment_link_clicked', pkg.id);
  });

  cards.appendChild(el);
}

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
