const salesForm = document.getElementById('salesForm');
const submitButton = document.getElementById('submitBtn');
const errorMessage = document.getElementById('formError');
const successMessage = document.getElementById('formSuccess');

async function submitContactSalesForm(event) {
  event.preventDefault();
  if (!salesForm || !submitButton || !errorMessage || !successMessage) return;

  errorMessage.style.display = 'none';
  submitButton.textContent = 'Sending…';
  submitButton.disabled = true;

  const body = {};
  new FormData(salesForm).forEach((value, key) => {
    body[key] = value;
  });
  body.name = `${body.firstName || ''} ${body.lastName || ''}`.trim();
  body.source = 'contact-sales-page';

  try {
    const res = await fetch('/api/contact-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    salesForm.style.display = 'none';
    successMessage.style.display = '';
  } catch (error) {
    errorMessage.textContent = error.message || 'Unable to send inquiry.';
    errorMessage.style.display = '';
  } finally {
    submitButton.textContent = 'Send Inquiry';
    submitButton.disabled = false;
  }
}

salesForm?.addEventListener('submit', submitContactSalesForm);
