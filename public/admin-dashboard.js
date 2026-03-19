import { escapeHtml } from '/order-shared.js';

let adminSessionReady = false;
let refreshTimer = null;

const loginScreen = document.getElementById('loginScreen');
const adminDash = document.getElementById('adminDash');
const logoutBtn = document.getElementById('logoutBtn');
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const apiKeyInput = document.getElementById('apiKey');
const dashError = document.getElementById('dashError');
const refreshBtn = document.getElementById('refreshBtn');
const logoutActionBtn = document.getElementById('logoutActionBtn');
const runWorkerBtn = document.getElementById('runWorkerBtn');

function normalizeStatusTone(status) {
  return /^[a-z_]+$/.test(status || '') ? status : 'failed';
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => {
    loadData().catch((error) => {
      console.warn('TraceWorks admin auto-refresh failed.', error);
    });
  }, 60000);
}

function syncAuthenticatedUi() {
  loginScreen.style.display = adminSessionReady ? 'none' : '';
  adminDash.style.display = adminSessionReady ? '' : 'none';
  logoutBtn.style.display = adminSessionReady ? '' : 'none';
}

function setOpsFeedback(message, tone = '') {
  const el = document.getElementById('opsFeedback');
  if (!el) return;
  el.textContent = message || '';
  if (!message) {
    el.style.display = 'none';
    el.removeAttribute('data-tone');
    return;
  }
  el.style.display = 'block';
  el.setAttribute('data-tone', tone || 'ok');
}

function renderActionButton(label, action, caseRef) {
  if (!caseRef) return '';
  return `<button class="mini-btn" data-admin-action="${escapeHtml(action)}" data-case-ref="${escapeHtml(caseRef)}">${escapeHtml(label)}</button>`;
}

async function postAdminAction(action, payload = {}) {
  const response = await fetch('/api/admin-actions', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = body.error || `HTTP ${response.status}`;
    const wrapped = new Error(error);
    wrapped.status = response.status;
    wrapped.payload = body;
    throw wrapped;
  }
  return body;
}

async function requeueCase(caseRef) {
  const result = await postAdminAction('requeue_case', { caseRef });
  const manualReviewNote = result.manualReviewLikely ? ' Manual review may still be needed for browser-backed sources.' : '';
  setOpsFeedback(`Case ${caseRef} requeued successfully.${manualReviewNote}`, result.manualReviewLikely ? 'warn' : 'ok');
  await loadData();
  return result;
}

async function runQueueOnce(caseRef = '') {
  const result = await postAdminAction('run_queue_once', caseRef ? { caseRef } : {});
  const target = result.caseRef ? ` for ${result.caseRef}` : '';
  const tone = result.manualReview ? 'warn' : 'ok';
  const message = result.message === 'no_jobs'
    ? `No queued fulfillment jobs were ready${target}.`
    : `Queue worker ran${target}.`;
  setOpsFeedback(message, tone);
  await loadData();
  return result;
}

async function logout() {
  stopAutoRefresh();
  try {
    await fetch('/api/admin-logout', { method: 'POST', credentials: 'same-origin' });
  } catch {}
  adminSessionReady = false;
  syncAuthenticatedUi();
  setOpsFeedback('');
}

function statusBadge(status) {
  const labels = {
    pending_payment: 'Payment Pending',
    paid: 'Payment Confirmed',
    queued: 'Queued',
    running: 'Research Running',
    processing: 'Processing',
    retry: 'Retry Scheduled',
    completed: 'Completed',
    manual_review: 'Manual Review',
    failed: 'Failed',
    delivery_failed: 'Delivery Failed',
    refunded: 'Refunded',
    canceled: 'Canceled'
  };
  const tone = normalizeStatusTone(status === 'retry' ? 'retrying' : status);
  return `<span class="status-badge s-${tone}">${escapeHtml(labels[status] || status || 'unknown')}</span>`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function fmtAmt(cents) {
  if (!cents) return '—';
  return '$' + (Number(cents) / 100).toFixed(2);
}

function renderInfoRows(targetId, rows, emptyText, formatter) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = rows.length
    ? rows.map(formatter).join('')
    : `<p style="font-size:12px;color:var(--text-4);">${escapeHtml(emptyText)}</p>`;
}

async function loadData() {
  dashError.style.display = 'none';

  try {
    const [metricsRes, ordersRes, healthRes] = await Promise.all([
      fetch('/api/admin-metrics', { credentials: 'same-origin' }),
      fetch('/api/admin-orders?limit=50', { credentials: 'same-origin' }),
      fetch('/api/health', { credentials: 'same-origin' })
    ]);

    if (metricsRes.status === 401 || ordersRes.status === 401 || healthRes.status === 401) {
      await logout();
      return;
    }

    const metrics = await metricsRes.json();
    const orders = await ordersRes.json();
    const health = await healthRes.json();

    document.getElementById('mTotal').textContent = orders.total ?? '—';
    document.getElementById('mRevenue').textContent = orders.aggregate?.revenueTotalFormatted || '—';
    document.getElementById('mQueue').textContent = metrics.metrics?.queueDepth ?? '—';
    document.getElementById('mFailed').textContent = metrics.metrics?.byStatus?.failed ?? 0;

    const missing = health.envMissing || [];
    const degraded = metrics.degraded;
    document.getElementById('healthStatus').innerHTML = degraded
      ? '<span style="font-size:10px;color:#f07070;"><span class="status-dot dot-error"></span>Degraded</span>'
      : '<span style="font-size:10px;color:#5ecb94;"><span class="status-dot dot-ok"></span>Healthy</span>';

    const healthChecks = [
      { label: 'Stripe', ok: !missing.includes('STRIPE_SECRET_KEY') },
      { label: 'Webhooks', ok: !missing.includes('STRIPE_WEBHOOK_SECRET') },
      { label: 'SMTP', ok: !missing.some((key) => key.startsWith('SMTP')) },
      { label: 'Queue', ok: (metrics.metrics?.queueDepth ?? 0) < 50 },
      { label: 'Failed Jobs', ok: (metrics.metrics?.byStatus?.failed ?? 0) === 0 },
      { label: 'Admin API Key', ok: true }
    ];
    document.getElementById('healthRows').innerHTML = healthChecks.map((check) =>
      `<div class="health-row"><span style="color:var(--text-2);">${escapeHtml(check.label)}</span><span class="status-dot ${check.ok ? 'dot-ok' : 'dot-error'}"></span></div>`
    ).join('');

    const byStatus = orders.aggregate?.byStatus || {};
    document.getElementById('byStatusRows').innerHTML = Object.entries(byStatus).length
      ? Object.entries(byStatus).map(([status, count]) => `<div class="health-row"><span>${statusBadge(status)}</span><span style="color:var(--text-1);font-weight:700;">${escapeHtml(count)}</span></div>`).join('')
      : '<p style="font-size:12px;color:var(--text-4);">No orders.</p>';

    const ops = metrics.operations || {};
    const manualReviewOrders = Array.isArray(ops.manualReviewOrders) ? ops.manualReviewOrders : [];
    const activeJobs = Array.isArray(ops.activeJobs) ? ops.activeJobs : [];
    const auditEvents = Array.isArray(ops.recentAuditEvents) ? ops.recentAuditEvents : [];
    const deadLetters = Array.isArray(ops.recentDeadLetters) ? ops.recentDeadLetters : [];

    document.getElementById('manualReviewCount').textContent = `${manualReviewOrders.length} visible`;
    renderInfoRows('manualReviewRows', manualReviewOrders, 'No orders are currently in manual review.', (order) => `
      <div class="health-row" style="display:block;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div>
            <div style="color:var(--text-1);font-weight:700;font-size:12px;">${escapeHtml(order.caseRef || order.order_id || '—')}</div>
            <div style="margin-top:4px;color:var(--text-3);font-size:11px;">${escapeHtml(order.packageId || order.purchased_tier || 'unknown package')} · ${escapeHtml(fmtDate(order.updatedAt || order.completed_at || order.createdAt))}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            ${renderActionButton('Requeue', 'requeue-case', order.caseRef || order.order_id || '')}
            <span>${statusBadge(order.status || 'manual_review')}</span>
          </div>
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--text-2);line-height:1.5;">${escapeHtml(order.failure_reason || 'Manual review required.')}</div>
      </div>
    `);

    document.getElementById('activeJobCount').textContent = `${activeJobs.length} active`;
    renderInfoRows('activeJobRows', activeJobs, 'No queued, retrying, or processing jobs right now.', (job) => `
      <div class="health-row" style="display:block;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div>
            <div style="color:var(--text-1);font-weight:700;font-size:12px;">${escapeHtml(job.payload?.caseRef || job.id)}</div>
            <div style="margin-top:4px;color:var(--text-3);font-size:11px;">${escapeHtml(job.type || 'job')} · attempts ${escapeHtml(job.attempts || 0)} · next ${escapeHtml(fmtDate(job.nextAttemptAt || job.updatedAt || job.createdAt))}</div>
          </div>
          <span>${statusBadge(job.status || 'queued')}</span>
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--text-2);line-height:1.5;">${escapeHtml(job.lastError || 'Awaiting worker action.')}</div>
      </div>
    `);

    document.getElementById('auditEventCount').textContent = `${auditEvents.length} recent`;
    renderInfoRows('auditEventRows', auditEvents, 'No recent audit events recorded yet.', (entry) => `
      <div class="health-row" style="display:block;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div>
            <div style="color:var(--text-1);font-weight:700;font-size:12px;">${escapeHtml(entry.event || 'audit_event')}</div>
            <div style="margin-top:4px;color:var(--text-3);font-size:11px;">${escapeHtml(entry.caseRef || entry.orderId || 'system')} · ${escapeHtml(fmtDate(entry.at))}</div>
          </div>
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--text-2);line-height:1.5;">${escapeHtml(entry.error || entry.status || entry.packageId || entry.tier || 'Recorded in audit log.')}</div>
      </div>
    `);

    document.getElementById('deadLetterCount').textContent = `${deadLetters.length} recent`;
    renderInfoRows('deadLetterRows', deadLetters, 'No dead letters recorded.', (entry) => `
      <div class="health-row" style="display:block;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div>
            <div style="color:var(--text-1);font-weight:700;font-size:12px;">${escapeHtml(entry.caseRef || entry.jobId || 'dead_letter')}</div>
            <div style="margin-top:4px;color:var(--text-3);font-size:11px;">${escapeHtml(entry.source || 'queue')} · ${escapeHtml(fmtDate(entry.at))}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            ${renderActionButton('Requeue', 'requeue-case', entry.caseRef || '')}
          </div>
        </div>
        <div style="margin-top:8px;font-size:12px;color:#f0a3a3;line-height:1.5;">${escapeHtml(entry.error || 'Unknown queue failure.')}</div>
      </div>
    `);

    const rows = Array.isArray(orders.orders) ? orders.orders : [];
    document.getElementById('orderCount').textContent = `Showing ${rows.length} of ${orders.total}`;
    document.getElementById('noOrders').style.display = rows.length ? 'none' : '';
    document.getElementById('ordersBody').innerHTML = rows.map((order) => `
      <tr>
        <td style="font-family:var(--mono);color:var(--text-1);">${escapeHtml(order.caseRef || '—')}</td>
        <td>${escapeHtml(order.packageId || order.tier || '—')}</td>
        <td>${statusBadge(order.status || 'unknown')}</td>
        <td>${escapeHtml(fmtDate(order.createdAt))}</td>
        <td>${escapeHtml(fmtAmt(order.amountTotal))}</td>
        <td style="color:${(order.fulfillmentAttempts || 0) > 2 ? '#f07070' : 'var(--text-2)'};">${escapeHtml(order.fulfillmentAttempts || 0)}</td>
      </tr>
    `).join('');

    document.getElementById('lastRefresh').textContent = `Last refreshed: ${new Date().toLocaleTimeString()}`;
    adminSessionReady = true;
    syncAuthenticatedUi();
    startAutoRefresh();
  } catch (error) {
    dashError.textContent = error.message;
    dashError.style.display = '';
  }
}

async function authenticate(event) {
  event.preventDefault();
  loginError.style.display = 'none';
  loginBtn.textContent = 'Authenticating…';
  loginBtn.disabled = true;
  const key = apiKeyInput.value.trim();
  try {
    const response = await fetch('/api/admin-login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key })
    });
    if (response.status === 401) throw new Error('Invalid API key.');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    adminSessionReady = true;
    syncAuthenticatedUi();
    await loadData();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.style.display = '';
  } finally {
    loginBtn.textContent = 'Authenticate';
    loginBtn.disabled = false;
  }
}

async function refresh() {
  await loadData();
}

loginForm?.addEventListener('submit', authenticate);
refreshBtn?.addEventListener('click', refresh);
logoutBtn?.addEventListener('click', logout);
logoutActionBtn?.addEventListener('click', logout);

runWorkerBtn?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Running…';
  try {
    await runQueueOnce();
  } catch (error) {
    if (error.status === 401) {
      await logout();
      return;
    }
    const tone = error.status === 409 || error.status === 202 ? 'warn' : 'error';
    setOpsFeedback(error.message, tone);
  } finally {
    button.disabled = false;
    button.textContent = 'Run Worker Once';
  }
});

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-admin-action]');
  if (!button) return;
  const action = button.dataset.adminAction || '';
  const caseRef = button.dataset.caseRef || '';
  if (action !== 'requeue-case' || !caseRef) return;

  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Requeueing…';
  try {
    await requeueCase(caseRef);
  } catch (error) {
    if (error.status === 401) {
      await logout();
      return;
    }
    const tone = error.status === 409 ? 'warn' : 'error';
    setOpsFeedback(error.message, tone);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
});

loadData()
  .then(() => {
    if (!adminSessionReady) syncAuthenticatedUi();
  })
  .catch(() => {
    syncAuthenticatedUi();
  });
