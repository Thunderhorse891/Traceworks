import {
  escapeHtml,
  formatShortDate,
  statusBadgeHtml
} from '/order-shared.js';

const STORAGE_KEY = 'tw_order_history';
const MAX_HISTORY = 5;

const lookupForm = document.getElementById('lookupForm');
const lookupBtn = document.getElementById('lookupBtn');
const lookupError = document.getElementById('lookupError');
const caseRefInput = document.getElementById('caseRef');
const emailInput = document.getElementById('email');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyList = document.getElementById('historyList');
const orderResult = document.getElementById('orderResult');
const resCaseRef = document.getElementById('resCaseRef');
const resBadge = document.getElementById('resBadge');
const resPackage = document.getElementById('resPackage');
const resSubject = document.getElementById('resSubject');
const resJurisdiction = document.getElementById('resJurisdiction');
const resCreated = document.getElementById('resCreated');
const resNote = document.getElementById('resNote');
const resStatusLink = document.getElementById('resStatusLink');

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (error) {
    console.warn('TraceWorks dashboard could not read local order history.', error);
    return [];
  }
}

function writeHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn('TraceWorks dashboard could not persist local order history.', error);
  }
}

function saveToHistory(order) {
  const history = getHistory().filter((entry) => entry.caseRef !== order.caseRef);
  history.unshift({
    caseRef: order.caseRef,
    status: order.status,
    packageId: order.packageName || order.packageId || order.tier || '—',
    subjectName: order.subjectName || '—',
    createdAt: order.createdAt,
    email: emailInput.value.trim().toLowerCase()
  });
  writeHistory(history.slice(0, MAX_HISTORY));
  renderHistory();
}

function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
}

function renderHistory() {
  const list = getHistory();
  if (!list.length) {
    historyList.innerHTML = '<div class="empty-state"><div style="font-size:32px;color:var(--text-4);">&#9634;</div><p>No recent orders saved locally.</p><p style="font-size:12px;">After tracking an order, it will appear here for quick re-access.</p></div>';
    return;
  }

  historyList.innerHTML = list.map((order) => {
    const href = order.email
      ? `/order-status.html?caseRef=${encodeURIComponent(order.caseRef)}&email=${encodeURIComponent(order.email)}`
      : `/dashboard.html?caseRef=${encodeURIComponent(order.caseRef)}`;

    return `<div class="order-row">
      <div>
        <div class="order-ref">${escapeHtml(order.caseRef)}</div>
        <div class="order-meta">${escapeHtml(order.packageId)} &nbsp;·&nbsp; ${escapeHtml(order.subjectName || '—')} &nbsp;·&nbsp; ${escapeHtml(formatShortDate(order.createdAt))}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        ${statusBadgeHtml(order.status)}
        <a href="${href}" style="font-size:12px;color:var(--gold);">View &rarr;</a>
      </div>
    </div>`;
  }).join('');
}

function renderResult(payload) {
  const order = payload.order || payload;
  resCaseRef.textContent = order.caseRef || '';
  resBadge.innerHTML = statusBadgeHtml(order.status);
  resPackage.textContent = order.packageName || order.packageId || order.tier || '—';
  resSubject.textContent = order.subjectName || '—';
  resJurisdiction.textContent = [order.county, order.state].filter(Boolean).join(', ') || '—';
  resCreated.textContent = formatShortDate(order.createdAt);
  resNote.textContent =
    order.status === 'completed'
      ? 'Your report has been delivered to your email address.'
      : order.status === 'manual_review'
        ? 'Research finished with gaps or blocked sources. A manual review step is required before delivery.'
        : order.status === 'delivery_failed'
          ? 'Your report is ready, but email delivery failed. Our team needs to resend it manually.'
          : order.status === 'failed'
            ? 'Investigation error — our team has been notified.'
            : order.status === 'canceled'
              ? 'Payment was canceled before the order entered production.'
              : order.status === 'refunded'
                ? 'This order has been refunded.'
                : 'Your investigation is in progress.';
  resStatusLink.href = `/order-status.html?caseRef=${encodeURIComponent(order.caseRef)}&email=${encodeURIComponent(emailInput.value.trim())}`;
  orderResult.style.display = '';
  saveToHistory(order);
}

async function lookupOrder(event) {
  event.preventDefault();
  lookupError.style.display = 'none';
  lookupBtn.textContent = 'Checking…';
  lookupBtn.disabled = true;

  try {
    const caseRef = caseRefInput.value.trim();
    const email = emailInput.value.trim();
    const params = new URLSearchParams({ caseRef, email });
    const response = await fetch(`/api/get-order?${params}`, { credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    renderResult(data);
  } catch (error) {
    lookupError.textContent = error.message;
    lookupError.style.display = '';
  } finally {
    lookupBtn.textContent = 'Check Status';
    lookupBtn.disabled = false;
  }
}

lookupForm?.addEventListener('submit', lookupOrder);
clearHistoryBtn?.addEventListener('click', clearHistory);

const params = new URLSearchParams(location.search);
if (params.get('caseRef')) caseRefInput.value = params.get('caseRef');
if (params.get('email')) emailInput.value = params.get('email');
if (params.get('caseRef') && params.get('email')) lookupForm?.requestSubmit();

renderHistory();
