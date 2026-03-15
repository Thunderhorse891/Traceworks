const page = document.body?.dataset?.page || '';
const ADMIN_KEY_STORAGE = 'traceworksAdminApiKey';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function money(cents) {
  const amount = Number(cents || 0) / 100;
  return `$${amount.toFixed(2)}`;
}

function chipClass(value) {
  const v = String(value || '').toLowerCase();
  if (['paid', 'completed', 'healthy', 'ok', 'delivered'].includes(v)) return 'ok';
  if (['retry', 'processing', 'queued', 'degraded', 'analyst_review', 'review', 'manual_review'].includes(v)) return 'warn';
  return 'danger';
}

function readAdminKey() {
  try {
    return localStorage.getItem(ADMIN_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

function writeAdminKey(value) {
  try {
    if (value) localStorage.setItem(ADMIN_KEY_STORAGE, value.trim());
    else localStorage.removeItem(ADMIN_KEY_STORAGE);
  } catch {
    // no-op
  }
}

function renderAuthBanner(message = '', forceVisible = false) {
  const target = document.getElementById('auth-banner');
  if (!target) return;

  const key = readAdminKey();
  if (!forceVisible && !message && key) {
    target.innerHTML = '';
    return;
  }

  const note = message || 'Enter ADMIN_API_KEY to load live operator data.';
  target.innerHTML = `
    <div class="tw-card" style="margin-bottom:14px;border-color:#5c3000;background:#1a1306;">
      <div class="tw-label">Admin access</div>
      <div style="margin-top:8px;color:#f2d49b;">${escapeHtml(note)}</div>
      <div class="tw-actions" style="margin-top:10px;">
        <button type="button" id="tw-set-admin-key">Set ADMIN_API_KEY</button>
        ${key ? '<button type="button" id="tw-clear-admin-key">Clear stored key</button>' : ''}
      </div>
    </div>
  `;

  document.getElementById('tw-set-admin-key')?.addEventListener('click', () => {
    const value = window.prompt('Paste ADMIN_API_KEY');
    if (value && value.trim()) {
      writeAdminKey(value.trim());
      boot().catch((error) => {
        renderAuthBanner(error.message || 'Failed to reload after saving key.', true);
      });
    }
  });

  document.getElementById('tw-clear-admin-key')?.addEventListener('click', () => {
    writeAdminKey('');
    renderAuthBanner('Stored ADMIN_API_KEY cleared.', true);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body.error || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return body;
}

async function adminJson(url) {
  const key = readAdminKey();

  if (!key) {
    const error = new Error('Missing ADMIN_API_KEY.');
    error.status = 401;
    throw error;
  }

  return fetchJson(url, {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });
}

async function adminBlob(url) {
  const key = readAdminKey();

  if (!key) {
    const error = new Error('Missing ADMIN_API_KEY.');
    error.status = 401;
    throw error;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response;
}

function filenameFromDisposition(disposition, fallback) {
  const match = /filename="?([^";]+)"?/i.exec(disposition || '');
  return match ? match[1] : fallback;
}

async function downloadAdminArtifact(caseRef, format) {
  try {
    const response = await adminBlob(`/api/order-artifact?caseRef=${encodeURIComponent(caseRef)}&format=${encodeURIComponent(format)}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    if (format === 'html') {
      window.open(blobUrl, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      return;
    }

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filenameFromDisposition(response.headers.get('content-disposition'), `${caseRef}-report.${format}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      writeAdminKey('');
      renderAuthBanner('Unauthorized. Set a valid ADMIN_API_KEY to download report artifacts.', true);
      return;
    }

    renderAuthBanner(error?.message || 'Unable to download report artifact.', true);
  }
}

window.traceworksDownloadArtifact = downloadAdminArtifact;

function setRows(targetId, html, fallback = '<tr><td colspan="8">No data.</td></tr>') {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = html && html.trim() ? html : fallback;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function orderStatusLabel(order) {
  return order.deliveryState || order.status || 'unknown';
}

function renderDashboardCards(metricsData, ordersData) {
  const target = document.getElementById('kpis');
  if (!target) return;

  const metrics = metricsData.metrics || {};
  const aggregate = ordersData.aggregate || {};
  const failed = Number(metrics.byStatus?.failed || 0);
  const cards = [
    ['Orders', String(metrics.ordersTotal ?? ordersData.total ?? 0)],
    ['Queue Depth', String(metrics.queueDepth ?? 0)],
    ['Failed', String(failed)],
    ['Revenue Total', aggregate.revenueTotalFormatted || '$0.00'],
  ];

  target.innerHTML = cards
    .map(([label, value]) => `
      <article class="tw-card">
        <div class="tw-label">${escapeHtml(label)}</div>
        <div class="tw-value">${escapeHtml(value)}</div>
      </article>
    `)
    .join('');
}

function renderDashboardRecentOrders(orders) {
  const html = orders
    .map((order) => `
      <tr>
        <td>${escapeHtml(order.caseRef || '—')}</td>
        <td>${escapeHtml(order.subjectName || order.customerName || '—')}</td>
        <td><span class="tw-chip ${chipClass(orderStatusLabel(order))}">${escapeHtml(orderStatusLabel(order))}</span></td>
        <td>${escapeHtml(order.packageName || order.packageId || '—')}</td>
        <td>${escapeHtml(order.customerEmail || '—')}</td>
      </tr>
    `)
    .join('');

  setRows('recent-cases', html, '<tr><td colspan="5">No live orders yet.</td></tr>');
}

function renderSourceRegistryPlaceholder() {
  setRows(
    'source-health',
    `
      <tr>
        <td>not_exposed</td>
        <td>operator</td>
        <td><span class="tw-chip warn">internal only</span></td>
        <td>Connector health is not exposed by this deployment.</td>
      </tr>
    `,
    '<tr><td colspan="4">Connector health is not exposed by this deployment.</td></tr>'
  );

  setRows(
    'sources-registry',
    `
      <tr>
        <td>not_exposed</td>
        <td>operator</td>
        <td>internal only</td>
        <td><span class="tw-chip warn">not exposed</span></td>
      </tr>
    `,
    '<tr><td colspan="4">Source registry is not exposed by this deployment.</td></tr>'
  );
}

async function renderDashboard() {
  const [metricsData, ordersData] = await Promise.all([
    adminJson('/api/admin-metrics'),
    adminJson('/api/admin-orders?limit=5'),
  ]);

  renderDashboardCards(metricsData, ordersData);
  renderDashboardRecentOrders(ordersData.orders || []);
  renderSourceRegistryPlaceholder();
}

async function renderCases() {
  const ordersData = await adminJson('/api/admin-orders?limit=100');
  const orders = ordersData.orders || [];

  const html = orders
    .map((order) => `
      <tr>
        <td>${escapeHtml(order.caseRef || '—')}</td>
        <td>${escapeHtml(order.subjectName || order.customerName || '—')}</td>
        <td>${escapeHtml(order.packageName || order.packageId || '—')}</td>
        <td><span class="tw-chip ${chipClass(orderStatusLabel(order))}">${escapeHtml(orderStatusLabel(order))}</span></td>
        <td>${escapeHtml([order.county, order.state].filter(Boolean).join(', ') || '—')}</td>
        <td>${escapeHtml(order.customerEmail || '—')}</td>
        <td>${escapeHtml(order.createdAt || '—')}</td>
      </tr>
    `)
    .join('');

  setRows('case-table-body', html, '<tr><td colspan="7">No live orders yet.</td></tr>');

  const detail = document.getElementById('case-detail');
  if (detail) {
    detail.innerHTML = `
      <div class="tw-label">Matter detail</div>
      <p style="margin-top:10px;color:var(--muted);">
        Use the live order rows above. A dedicated case-detail endpoint is still required before deeper drilldown can be shown here safely.
      </p>
    `;
  }
}

async function renderWorkflows() {
  const data = await fetchJson('/api/packages');
  const packages = data.packages || [];

  const html = packages
    .map((pkg) => `
      <tr>
        <td>${escapeHtml(pkg.name || pkg.id || '—')}</td>
        <td>${escapeHtml(money(pkg.amount))}</td>
        <td><span class="tw-chip ${chipClass(pkg.launchReady === false ? 'manual_review' : 'ok')}">${escapeHtml(pkg.launchReady === false ? 'blocked' : 'ready')}</span></td>
        <td>${escapeHtml(String((pkg.sections || []).length))}</td>
        <td>${escapeHtml(`${pkg.deliveryHours || '—'}h`)}</td>
      </tr>
    `)
    .join('');

  setRows('workflow-defs', html, '<tr><td colspan="5">No package catalog returned.</td></tr>');
}

async function renderSources() {
  renderSourceRegistryPlaceholder();
}

async function renderBilling() {
  const [metricsData, ordersData] = await Promise.all([
    adminJson('/api/admin-metrics'),
    adminJson('/api/admin-orders?limit=100'),
  ]);

  const metrics = metricsData.metrics || {};
  const orders = ordersData.orders || [];
  const aggregate = ordersData.aggregate || {};

  const packageCounts = new Map();
  for (const order of orders) {
    const key = order.packageName || order.packageId || 'unknown';
    packageCounts.set(key, (packageCounts.get(key) || 0) + 1);
  }

  const topPackage = [...packageCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const enterpriseBatchCount = orders.filter((o) => String(o.packageId || '').toLowerCase() === 'custom').length;

  setText('billing-top-package', topPackage ? `${topPackage[0]} (${topPackage[1]})` : 'No paid orders yet');
  setText('billing-conversion', 'n/a');
  setText('billing-revenue', aggregate.revenueTotalFormatted || '$0.00');
  setText('billing-enterprise', String(enterpriseBatchCount));
  setText('billing-queue-depth', String(metrics.queueDepth ?? 0));

  const html = orders
    .slice(0, 25)
    .map((order) => `
      <tr>
        <td>${escapeHtml(order.caseRef || '—')}</td>
        <td>${escapeHtml(order.packageName || order.packageId || '—')}</td>
        <td>${escapeHtml(money(order.amountTotal || 0))}</td>
        <td><span class="tw-chip ${chipClass(orderStatusLabel(order))}">${escapeHtml(orderStatusLabel(order))}</span></td>
      </tr>
    `)
    .join('');

  setRows('billing-orders-body', html, '<tr><td colspan="4">No billing activity recorded yet.</td></tr>');
}

async function renderReports() {
  const ordersData = await adminJson('/api/admin-orders?limit=100');
  const orders = ordersData.orders || [];

  const html = orders
    .map((order) => {
      const hasArtifact = Boolean(order.caseRef && order.artifact_url_or_path);
      const artifact = hasArtifact
        ? `
          <div class="tw-actions">
            <button type="button" onclick='traceworksDownloadArtifact(${JSON.stringify(String(order.caseRef || ''))}, "pdf")'>PDF</button>
            <button type="button" onclick='traceworksDownloadArtifact(${JSON.stringify(String(order.caseRef || ''))}, "html")'>HTML</button>
          </div>
        `
        : 'Pending / not generated';

      return `
        <tr>
          <td>${escapeHtml(order.caseRef || '—')}</td>
          <td>${escapeHtml(order.packageName || order.packageId || '—')}</td>
          <td>v1</td>
          <td><span class="tw-chip ${chipClass(orderStatusLabel(order))}">${escapeHtml(orderStatusLabel(order))}</span></td>
          <td>${artifact}</td>
        </tr>
      `;
    })
    .join('');

  setRows('reports-table-body', html, '<tr><td colspan="5">No live reports yet.</td></tr>');
}

async function boot() {
  try {
    if (['dashboard', 'cases', 'billing', 'reports'].includes(page)) {
      renderAuthBanner('', false);
    }

    if (page === 'dashboard') await renderDashboard();
    if (page === 'cases') await renderCases();
    if (page === 'workflows') await renderWorkflows();
    if (page === 'sources') await renderSources();
    if (page === 'billing') await renderBilling();
    if (page === 'reports') await renderReports();
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      writeAdminKey('');
      renderAuthBanner('Unauthorized. Set a valid ADMIN_API_KEY to load live operator data.', true);
      return;
    }

    renderAuthBanner(error?.message || 'Failed to load live operator data.', true);

    setRows('recent-cases', '<tr><td colspan="5">Unable to load live data.</td></tr>');
    setRows('source-health', '<tr><td colspan="4">Unable to load live data.</td></tr>');
    setRows('case-table-body', '<tr><td colspan="7">Unable to load live data.</td></tr>');
    setRows('workflow-defs', '<tr><td colspan="4">Unable to load workflow catalog.</td></tr>');
    setRows('sources-registry', '<tr><td colspan="4">Unable to load source registry.</td></tr>');
    setRows('billing-orders-body', '<tr><td colspan="4">Unable to load billing data.</td></tr>');
    setRows('reports-table-body', '<tr><td colspan="5">Unable to load report data.</td></tr>');
  }
}

boot();
