const keyEl = document.getElementById('key');
const loadButton = document.getElementById('load');
const statusEl = document.getElementById('status');
const table = document.getElementById('table');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function artifactActionMarkup(order) {
  const caseRef = order.order_id || order.caseRef || '';
  if (!order.artifact_url_or_path || !caseRef) return '<small>pending</small>';

  return `
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button type="button" data-case-ref="${escapeHtml(caseRef)}" data-artifact-format="pdf">PDF</button>
      <button type="button" data-case-ref="${escapeHtml(caseRef)}" data-artifact-format="html">HTML</button>
    </div>
  `;
}

function filenameFromDisposition(disposition, fallback) {
  const match = /filename="?([^";]+)"?/i.exec(disposition || '');
  return match ? match[1] : fallback;
}

async function downloadArtifact(caseRef, format) {
  const key = keyEl.value.trim();
  if (!key) {
    statusEl.textContent = 'Admin API key required.';
    return;
  }

  statusEl.textContent = `Loading ${format.toUpperCase()} for ${caseRef}...`;

  try {
    const response = await fetch(`/api/order-artifact?caseRef=${encodeURIComponent(caseRef)}&format=${encodeURIComponent(format)}`, {
      credentials: 'same-origin',
      headers: { authorization: `Bearer ${key}` }
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    if (format === 'html') {
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filenameFromDisposition(response.headers.get('content-disposition'), `${caseRef}-report.${format}`);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }

    statusEl.textContent = `${format.toUpperCase()} ready for ${caseRef}.`;
  } catch (error) {
    statusEl.textContent = error.message || 'Unable to download artifact.';
  }
}

function render(orders) {
  const head = `
    <thead><tr>
      <th>order_id</th><th>customer</th><th>tier</th><th>stripe state</th><th>fulfillment state</th>
      <th>workflow selected</th><th>sources attempted/success/blocked</th><th>started_at</th><th>completed_at</th>
      <th>artifact</th><th>email_delivery</th><th>failure_reason</th><th>workflow JSON</th>
    </tr></thead>`;

  const body = `<tbody>${orders.map((order) => {
    const sources = Array.isArray(order.sources_queried) ? order.sources_queried : [];
    const attempted = sources.length;
    const success = sources.filter((source) => source.status === 'found').length;
    const blocked = sources.filter((source) => ['blocked', 'unavailable', 'error'].includes(source.status)).length;
    return `
      <tr>
        <td>${escapeHtml(order.order_id || order.caseRef)}</td>
        <td>${escapeHtml(order.customerName)}<br/><small>${escapeHtml(order.customerEmail)}</small></td>
        <td>${escapeHtml(order.purchased_tier)}</td>
        <td>${escapeHtml(order.stripe_payment_intent_id || order.stripe_checkout_session_id || 'n/a')}</td>
        <td>${escapeHtml(order.status)}</td>
        <td>${escapeHtml(order.workflow_selected || order.purchased_tier || 'n/a')}</td>
        <td><small>${escapeHtml(`${attempted}/${success}/${blocked}`)}</small></td>
        <td>${escapeHtml(order.started_at || 'n/a')}</td>
        <td>${escapeHtml(order.completed_at || 'n/a')}</td>
        <td>${artifactActionMarkup(order)}</td>
        <td>${escapeHtml(order.email_delivery_status || 'pending')}</td>
        <td><small>${escapeHtml(order.failure_reason || 'n/a')}</small></td>
        <td><details><summary>view</summary><pre style="white-space:pre-wrap;max-width:360px;">${escapeHtml(JSON.stringify(order.workflow_results || {}, null, 2))}</pre></details></td>
      </tr>
    `;
  }).join('')}</tbody>`;

  table.innerHTML = head + body;
}

async function loadOrders() {
  const key = keyEl.value.trim();
  if (!key) {
    statusEl.textContent = 'Admin API key required.';
    return;
  }

  statusEl.textContent = 'Loading orders...';
  const response = await fetch('/api/admin-orders', {
    credentials: 'same-origin',
    headers: { authorization: `Bearer ${key}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    statusEl.textContent = data.error || 'Unable to load admin orders.';
    return;
  }

  const orders = Array.isArray(data.orders) ? data.orders : [];
  statusEl.textContent = `Loaded ${orders.length} orders.`;
  render(orders);
}

loadButton?.addEventListener('click', loadOrders);

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-artifact-format]');
  if (!button) return;
  downloadArtifact(button.dataset.caseRef || '', button.dataset.artifactFormat || '');
});
