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

  // Build card content safely without innerHTML XSS risk
  const label = document.createElement('p');
  label.className = 'label';
  label.textContent = pkg.id.toUpperCase().replace(/_/g, ' ');

  const title = document.createElement('h4');
  title.textContent = pkg.name;

  const price = document.createElement('p');
  price.className = 'price';
  price.textContent = pkg.price;

  const desc = document.createElement('p');
  desc.className = 'card-desc';
  desc.textContent = pkg.description || '';

  const ul = document.createElement('ul');
  for (const b of pkg.bullets) {
    const li = document.createElement('li');
    li.textContent = b;
    ul.appendChild(li);
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = pkg.payLink ? 'Select Package' : 'Contact for Quote';

  el.appendChild(label);
  el.appendChild(title);
  el.appendChild(price);
  el.appendChild(desc);
  el.appendChild(ul);
  el.appendChild(btn);

  if (pkg.payLink) {
    const payLinkEl = document.createElement('a');
    payLinkEl.className = 'pay-link';
    payLinkEl.href = pkg.payLink;
    payLinkEl.target = '_blank';
    payLinkEl.rel = 'noopener';
    payLinkEl.textContent = 'Open Stripe Payment Link →';
    el.appendChild(payLinkEl);

    payLinkEl.addEventListener('click', async () => {
      packageInput.value = pkg.id;
      await track('payment_link_clicked', pkg.id);
    });
  }

  btn.addEventListener('click', async () => {
    if (!pkg.payLink) {
      document.getElementById('enterprise')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    document.querySelectorAll('.card').forEach((c) => c.classList.remove('selected'));
    el.classList.add('selected');
    packageInput.value = pkg.id;
    statusEl.textContent = `${pkg.name} selected. Fill out the form below to proceed to secure checkout.`;
    await track('package_selected', pkg.id);
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

  let response, data;
  try {
    response = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    data = await response.json();
  } catch {
    statusEl.textContent = 'Network error. Please check your connection and try again.';
    await track('checkout_error', 'network_failure');
    return;
  }

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

    let res, data;
    try {
      res = await fetch('/api/contact-sales', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      data = await res.json();
    } catch {
      salesStatus.textContent = 'Network error. Please try again.';
      await track('sales_lead_error', 'network_failure');
      return;
    }

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
