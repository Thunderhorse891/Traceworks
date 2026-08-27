const checkoutForm = document.getElementById('checkoutForm');
const statusEl = document.getElementById('status');
const submitButton = checkoutForm?.querySelector('button[type="submit"]');

function setStatus(message, type = '') {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

function checked(form, name) {
  return form?.querySelector(`[name="${name}"]`)?.checked === true;
}

function validateForm(form) {
  const data = new FormData(form);
  const customerName = String(data.get('customerName') || '').trim();
  const customerEmail = String(data.get('customerEmail') || '').trim();
  const propertyQuery = String(data.get('subjectName') || '').trim();

  if (customerName.length < 2) return 'Enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return 'Enter a valid delivery email.';
  if (propertyQuery.length < 2) return 'Enter an owner name, property address, or WCAD property number.';
  if (!checked(form, 'legalConsent')) return 'Confirm the report will be used for a lawful purpose.';
  if (!checked(form, 'tosConsent')) return 'Accept the terms and service policy to continue.';
  return '';
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let data = {};
  try { data = await response.json(); }
  catch { throw new Error('TraceWorks returned an unreadable response. Please try again.'); }
  if (!response.ok) throw new Error(data.error || 'Unable to continue right now.');
  return data;
}

checkoutForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const validationError = validateForm(form);
  if (validationError) {
    setStatus(validationError, 'error');
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  payload.legalConsent = checked(form, 'legalConsent');
  payload.tosConsent = checked(form, 'tosConsent');
  submitButton.disabled = true;
  submitButton.textContent = 'Checking Williamson County coverage…';
  setStatus('Verifying that this request is supported.', 'working');

  try {
    const preflight = await postJson('/api/intake-preflight', payload);
    if (!preflight.launchReady) throw new Error(preflight.launchMessage || 'This request is not currently supported.');
    submitButton.textContent = 'Opening secure Stripe checkout…';
    setStatus('Coverage confirmed. Creating your secure checkout.', 'working');
    const checkout = await postJson('/api/create-checkout', payload);
    if (!checkout.checkoutUrl) throw new Error('Stripe checkout did not return a payment link.');
    window.location.assign(checkout.checkoutUrl);
  } catch (error) {
    setStatus(String(error?.message || error || 'Unable to continue right now.'), 'error');
    submitButton.disabled = false;
    submitButton.textContent = 'Continue to secure checkout · $99';
  }
});

document.getElementById('year').textContent = String(new Date().getFullYear());
