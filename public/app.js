import { clientPackages } from './packages.js';

// Register service worker for PWA offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// PWA install prompt
let _installPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _installPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.hidden = false;
});

window.addEventListener('appinstalled', () => {
  _installPrompt = null;
  const btn = document.getElementById('installBtn');
  if (btn) btn.hidden = true;
});

async function triggerInstall() {
  if (!_installPrompt) return;
  _installPrompt.prompt();
  const { outcome } = await _installPrompt.userChoice;
  if (outcome === 'accepted') _installPrompt = null;
}

window.triggerInstall = triggerInstall;

const packageInput = document.getElementById('packageId');
const statusEl = document.getElementById('status');

const packagesGrid = document.getElementById('packages-grid');

async function track(type, detail = '') {
  try {
    await fetch('/api/track-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, packageId: packageInput?.value || '', page: 'home', detail })
    });
  } catch {}
}

function buildCard(pkg, index) {
  const el = document.createElement('article');
  el.className = 'card' + (pkg.id === 'comprehensive' ? ' card-featured' : '');
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');

  const idx = document.createElement('span');
  idx.className = 'card-index';
  idx.textContent = String(index + 1).padStart(2, '0');

  const title = document.createElement('h4');
  title.textContent = pkg.name;

  const priceWrap = document.createElement('div');
  const priceEl = document.createElement('div');
  priceEl.className = 'price';
  priceEl.textContent = pkg.price;
  const priceLabel = document.createElement('div');
  priceLabel.className = 'price-label';
  priceLabel.textContent = pkg.id === 'custom' ? 'Contact for scope' : 'Per report';
  priceWrap.appendChild(priceEl);
  priceWrap.appendChild(priceLabel);

  const divider = document.createElement('div');
  divider.className = 'card-divider';

  const ul = document.createElement('ul');
  for (const b of pkg.bullets) {
    const li = document.createElement('li');
    li.textContent = b;
    ul.appendChild(li);
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'card-btn' + (pkg.id === 'custom' ? ' custom-btn' : '');
  btn.textContent = pkg.payLink ? 'Select This Report' : 'Request Custom Quote';

  el.appendChild(idx);
  el.appendChild(title);
  el.appendChild(priceWrap);
  el.appendChild(divider);
  el.appendChild(ul);
  el.appendChild(btn);

  if (pkg.payLink) {
    const payLinkEl = document.createElement('a');
    payLinkEl.className = 'pay-link';
    payLinkEl.href = pkg.payLink;
    payLinkEl.target = '_blank';
    payLinkEl.rel = 'noopener';
    payLinkEl.textContent = 'Direct Stripe Payment Link';
    el.appendChild(payLinkEl);

    payLinkEl.addEventListener('click', async () => {
      if (packageInput) packageInput.value = pkg.id;
      await track('payment_link_clicked', pkg.id);
    });
  }

  function selectCard() {
    if (!pkg.payLink) {
      document.getElementById('enterprise')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    document.querySelectorAll('.card').forEach((c) => c.classList.remove('selected'));
    el.classList.add('selected');
    if (packageInput) packageInput.value = pkg.id;
    if (statusEl) statusEl.textContent = `${pkg.name} selected — complete the form below.`;
    document.getElementById('order')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    track('package_selected', pkg.id);
  }

  btn.addEventListener('click', selectCard);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCard(); } });

  return el;
}

// Render all packages: paid first, custom (contact-us) last
const paid   = clientPackages.filter((p) => p.id !== 'custom');
const custom = clientPackages.filter((p) => p.id === 'custom');
const allOrdered = [...paid, ...custom];

allOrdered.forEach((pkg, i) => packagesGrid?.appendChild(buildCard(pkg, i)));

// ── Checkout Form ────────────────────────────────────────────────────
function checked(form, name) {
  return form.querySelector(`[name="${name}"]`)?.checked === true;
}

document.getElementById('checkoutForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

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

  if (statusEl) statusEl.textContent = 'Creating secure checkout session…';
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
    if (statusEl) statusEl.textContent = 'Network error — please check your connection and try again.';
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

// ── Enterprise Form ──────────────────────────────────────────────────
const salesStatus = document.getElementById('salesStatus');

document.getElementById('salesForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  if (salesStatus) salesStatus.textContent = 'Submitting inquiry…';
  const payload = Object.fromEntries(new FormData(form).entries());

  let res, data;
  try {
    res = await fetch('/api/contact-sales', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    data = await res.json();
  } catch {
    if (salesStatus) salesStatus.textContent = 'Network error. Please try again.';
    await track('sales_lead_error', 'network_failure');
    return;
  }

  if (!res.ok) {
    if (salesStatus) salesStatus.textContent = data.error || 'Unable to submit inquiry right now.';
    await track('sales_lead_error', data.error || 'unknown');
    return;
  }

  if (salesStatus) salesStatus.textContent = 'Received. We will be in touch from traceworks.tx@outlook.com.';
  form.reset();
  await track('sales_lead_submitted', payload.monthlyCases || '');
});
