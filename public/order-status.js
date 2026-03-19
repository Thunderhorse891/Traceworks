import {
  ARTIFACT_READY_STATUSES,
  TERMINAL_STATUSES,
  briefSignals,
  buildArtifactUrl,
  confirmationDeliveryLabel,
  formatShortDate,
  renderSignalChips,
  statusBadgeHtml
} from '/order-shared.js';

let pollTimer = null;
let currentCaseRef = '';
let currentEmail = '';
let currentStatusToken = '';

const lookupForm = document.getElementById('lookupForm');
const lookupBtn = document.getElementById('lookupBtn');
const lookupError = document.getElementById('lookupError');
const caseRefInput = document.getElementById('caseRef');
const emailInput = document.getElementById('email');
const orderResult = document.getElementById('orderResult');
const resCaseRef = document.getElementById('resCaseRef');
const resBadge = document.getElementById('resBadge');
const resPackage = document.getElementById('resPackage');
const resSubject = document.getElementById('resSubject');
const resJurisdiction = document.getElementById('resJurisdiction');
const resCreated = document.getElementById('resCreated');
const resConfirmation = document.getElementById('resConfirmation');
const completedRow = document.getElementById('completedRow');
const resCompleted = document.getElementById('resCompleted');
const resNote = document.getElementById('resNote');
const timeline = document.getElementById('timeline');
const reportActions = document.getElementById('reportActions');
const reportPdfLink = document.getElementById('reportPdfLink');
const reportHtmlLink = document.getElementById('reportHtmlLink');
const briefPanel = document.getElementById('briefPanel');
const resRequestedFindings = document.getElementById('resRequestedFindings');
const resGoals = document.getElementById('resGoals');
const resSignalStrength = document.getElementById('resSignalStrength');
const resSignalChips = document.getElementById('resSignalChips');

function timelineHtml(status) {
  const steps = [
    { label: 'Payment Confirmed', sub: 'Stripe checkout completed' },
    { label: 'Queued for Investigation', sub: 'Job added to processing queue' },
    { label: 'Research Running', sub: 'Connectors active — querying public records' },
    { label: 'Report Delivered', sub: 'Results emailed to your inbox' }
  ];

  const states = {
    pending_payment: { done: [], active: -1 },
    paid: { done: [0], active: 1 },
    queued: { done: [0], active: 1 },
    running: { done: [0, 1], active: 2 },
    completed: { done: [0, 1, 2, 3], active: -1 },
    manual_review: { done: [0, 1, 2], active: -1 },
    delivery_failed: { done: [0, 1, 2], active: -1 },
    failed: { done: [0, 1], active: -1 },
    refunded: { done: [0], active: -1 },
    canceled: { done: [], active: -1 }
  };

  const state = states[status] || { done: [], active: -1 };
  return steps.map((step, index) => {
    let dotClass = 'pending';
    if (state.done.includes(index)) dotClass = 'done';
    else if (state.active === index) dotClass = 'active';
    return `<div class="tl-step"><div class="tl-dot ${dotClass}"></div><div><div class="tl-label">${step.label}</div><div class="tl-sub">${step.sub}</div></div></div>`;
  }).join('');
}

function renderBrief(data) {
  const input = data.input_criteria || {};
  const requested = input.requestedFindingsList?.length
    ? input.requestedFindingsList.join('; ')
    : input.requestedFindings || '';
  const goals = input.goals || '';
  const signals = briefSignals(input);
  const hasBrief = Boolean(requested || goals || signals.length);

  briefPanel.style.display = hasBrief ? 'block' : 'none';
  if (!hasBrief) return;

  resRequestedFindings.textContent = requested || 'No requested-findings note was stored for this order.';
  resGoals.textContent = goals || 'No explicit case objective was stored for this order.';
  resSignalStrength.textContent = `${signals.length} identifiers`;
  resSignalChips.innerHTML = renderSignalChips(signals);
}

function syncReportActions(data) {
  const ready = Boolean(data.caseRef && data.artifact_url_or_path && ARTIFACT_READY_STATUSES.has(data.status));

  if (!ready) {
    reportActions.style.display = 'none';
    reportPdfLink.removeAttribute('href');
    reportHtmlLink.removeAttribute('href');
    return;
  }

  reportPdfLink.href = buildArtifactUrl({
    caseRef: data.caseRef,
    format: 'pdf',
    statusToken: currentStatusToken,
    email: currentEmail
  });
  reportHtmlLink.href = buildArtifactUrl({
    caseRef: data.caseRef,
    format: 'html',
    statusToken: currentStatusToken,
    email: currentEmail
  });
  reportActions.style.display = 'flex';
}

function renderOrder(payload) {
  const data = payload.order || payload;
  resCaseRef.textContent = data.caseRef || '';
  resBadge.innerHTML = statusBadgeHtml(data.status || 'unknown');
  resPackage.textContent = data.packageName || data.packageId || data.tier || '—';
  resSubject.textContent = data.subjectName || '—';
  resJurisdiction.textContent = [data.county, data.state].filter(Boolean).join(', ') || '—';
  resCreated.textContent = formatShortDate(data.createdAt);
  resConfirmation.textContent = confirmationDeliveryLabel(data.payment_confirmation_email_status);

  completedRow.style.display = data.completedAt ? '' : 'none';
  if (data.completedAt) {
    resCompleted.textContent = new Date(data.completedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  timeline.innerHTML = timelineHtml(data.status || '');

  if (data.status === 'completed') {
    resNote.textContent = 'Your report has been delivered to your email address. Check your inbox and spam folder.';
  } else if (data.status === 'manual_review') {
    resNote.textContent = 'Research finished, but a manual review step is required before delivery because some sources were incomplete or blocked.';
  } else if (data.status === 'delivery_failed') {
    resNote.textContent = 'Your report is ready, but email delivery failed. Our team needs to resend it manually.';
  } else if (data.status === 'failed') {
    resNote.textContent = 'Investigation encountered an error. Our team has been notified and will follow up within 24 hours.';
  } else if (data.status === 'canceled') {
    resNote.textContent = 'Payment was canceled before the order entered production.';
  } else if (data.status === 'refunded') {
    resNote.textContent = 'This order has been refunded.';
  } else if (data.retryAt) {
    resNote.textContent = `The workflow hit a temporary issue and is queued to retry around ${new Date(data.retryAt).toLocaleString()}.`;
  } else {
    resNote.textContent = data.payment_confirmation_email_status === 'sent'
      ? 'Payment confirmation email was sent successfully. Research is progressing through the queue.'
      : '';
  }

  syncReportActions(data);
  renderBrief(data);
  orderResult.style.display = '';
}

function clearPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function fetchOrder() {
  try {
    const params = new URLSearchParams({ caseRef: currentCaseRef });
    if (currentStatusToken) params.set('status_token', currentStatusToken);
    else params.set('email', currentEmail);
    const response = await fetch(`/api/get-order?${params}`, { credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    const order = data.order || data;
    renderOrder(order);
    if (TERMINAL_STATUSES.has(order.status)) clearPolling();
  } catch (error) {
    clearPolling();
    console.warn('TraceWorks order tracker could not refresh status.', error);
    lookupError.textContent = error.message;
    lookupError.style.display = '';
    orderResult.style.display = 'none';
  }
}

async function lookupOrder(event) {
  event.preventDefault();
  lookupError.style.display = 'none';
  lookupBtn.textContent = 'Checking…';
  lookupBtn.disabled = true;

  currentCaseRef = caseRefInput.value.trim();
  currentEmail = emailInput.value.trim();
  currentStatusToken = '';
  clearPolling();

  try {
    const params = new URLSearchParams({ caseRef: currentCaseRef, email: currentEmail });
    const response = await fetch(`/api/get-order?${params}`, { credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

    const order = data.order || data;
    renderOrder(order);
    if (!TERMINAL_STATUSES.has(order.status)) {
      pollTimer = setInterval(fetchOrder, 30000);
    }
  } catch (error) {
    lookupError.textContent = error.message;
    lookupError.style.display = '';
  } finally {
    lookupBtn.textContent = 'Check Status';
    lookupBtn.disabled = false;
  }
}

lookupForm?.addEventListener('submit', lookupOrder);
window.addEventListener('beforeunload', clearPolling);

const params = new URLSearchParams(location.search);
if (params.get('caseRef')) caseRefInput.value = params.get('caseRef');
if (params.get('email')) emailInput.value = params.get('email');
if (params.get('status_token') || params.get('statusToken')) {
  currentStatusToken = params.get('status_token') || params.get('statusToken');
  currentCaseRef = params.get('caseRef') || '';
}

if (params.get('caseRef') && params.get('email')) {
  lookupForm?.requestSubmit();
} else if (params.get('caseRef') && currentStatusToken) {
  fetchOrder();
  pollTimer = setInterval(fetchOrder, 30000);
}
