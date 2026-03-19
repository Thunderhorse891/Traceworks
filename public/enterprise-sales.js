const enterpriseSalesForm = document.getElementById('salesForm');
const enterpriseSalesButton = document.getElementById('salesBtn');
const enterpriseSalesError = document.getElementById('salesError');
const enterpriseSalesSuccess = document.getElementById('formSuccess');

async function submitEnterpriseSalesForm(event) {
  event.preventDefault();
  if (!enterpriseSalesForm || !enterpriseSalesButton || !enterpriseSalesError || !enterpriseSalesSuccess) return;

  enterpriseSalesError.style.display = 'none';
  enterpriseSalesButton.textContent = 'Sending…';
  enterpriseSalesButton.disabled = true;

  const body = {};
  new FormData(enterpriseSalesForm).forEach((value, key) => {
    if (key !== '_hp') body[key] = value;
  });
  body.name = `${body.firstName || ''} ${body.lastName || ''}`.trim();
  body.source = 'enterprise-page';

  try {
    const res = await fetch('/api/contact-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    enterpriseSalesForm.style.display = 'none';
    enterpriseSalesSuccess.style.display = '';
  } catch (error) {
    enterpriseSalesError.textContent = error.message || 'Unable to send inquiry.';
    enterpriseSalesError.style.display = '';
  } finally {
    enterpriseSalesButton.textContent = 'Send Message';
    enterpriseSalesButton.disabled = false;
  }
}

enterpriseSalesForm?.addEventListener('submit', submitEnterpriseSalesForm);
