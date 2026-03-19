import {
  ARTIFACT_READY_STATUSES,
  TERMINAL_STATUSES,
  briefSignals,
  buildArtifactUrl,
  confirmationDeliveryLabel,
  formatDateTime,
  renderSignalChips,
  statusLabel,
  statusVariant
} from '/order-shared.js';

const params = new URLSearchParams(location.search);
const caseRef = params.get('case_ref');
const email = params.get('email');
const statusToken = params.get('status_token') || params.get('statusToken');

const statusPill = document.getElementById('statusPill');
const fieldCaseRef = document.getElementById('fieldCaseRef');
const fieldPackage = document.getElementById('fieldPackage');
const fieldSubject = document.getElementById('fieldSubject');
const fieldJurisdiction = document.getElementById('fieldJurisdiction');
const fieldStatus = document.getElementById('fieldStatus');
const fieldConfirmation = document.getElementById('fieldConfirmation');
const fieldQueued = document.getElementById('fieldQueued');
const fieldAttempts = document.getElementById('fieldAttempts');
const fieldCompleted = document.getElementById('fieldCompleted');
const fieldError = document.getElementById('fieldError');
const rowCompleted = document.getElementById('rowCompleted');
const rowError = document.getElementById('rowError');
const stepResearch = document.getElementById('stepResearch');
const stepReport = document.getElementById('stepReport');
const stepDelivery = document.getElementById('stepDelivery');
const briefPanel = document.getElementById('briefPanel');
const briefSignalPill = document.getElementById('briefSignalPill');
const fieldRequestedFindings = document.getElementById('fieldRequestedFindings');
const fieldGoals = document.getElementById('fieldGoals');
const briefSignalChips = document.getElementById('briefSignalChips');
const reportPdfLink = document.getElementById('reportPdfLink');
const reportHtmlLink = document.getElementById('reportHtmlLink');

let pollInterval = null;

function setPill(status) {
  statusPill.className = `status-pill ${statusVariant(status) || 'default'}`;
  statusPill.textContent = statusLabel(status).toUpperCase();
}

function updateTimeline(status) {
  const active = 'timeline-step-dot active';
  const done = 'timeline-step-dot done';
  const pending = 'timeline-step-dot';

  if (status === 'completed') {
    stepResearch.className = done;
    stepReport.className = done;
    stepDelivery.className = done;
    return;
  }

  if (status === 'running') {
    stepResearch.className = active;
    stepReport.className = pending;
    stepDelivery.className = pending;
    return;
  }

  if (status === 'manual_review' || status === 'delivery_failed') {
    stepResearch.className = done;
    stepReport.className = done;
    stepDelivery.className = pending;
    return;
  }

  if (status === 'failed') {
    stepResearch.className = pending;
    stepReport.className = pending;
    stepDelivery.className = pending;
    return;
  }

  stepResearch.className = active;
  stepReport.className = pending;
  stepDelivery.className = pending;
}

function renderBrief(data) {
  const input = data.input_criteria || {};
  const requested = input.requestedFindingsList?.length
    ? input.requestedFindingsList.join('; ')
    : input.requestedFindings || '';
  const goals = input.goals || '';
  const signals = briefSignals(input);
  const hasBrief = Boolean(requested || goals || signals.length);

  briefPanel.style.display = hasBrief ? '' : 'none';
  if (!hasBrief) return;

  fieldRequestedFindings.textContent = requested || 'No custom requested-findings note was stored for this order.';
  fieldGoals.textContent = goals || 'No explicit case objective was stored for this order.';
  briefSignalPill.textContent = `${signals.length} identifiers`;
  briefSignalChips.innerHTML = renderSignalChips(signals);
}

function syncReportActions(data) {
  const ready = Boolean(data.caseRef && data.artifact_url_or_path && ARTIFACT_READY_STATUSES.has(data.status));

  if (!ready) {
    reportPdfLink.style.display = 'none';
    reportHtmlLink.style.display = 'none';
    reportPdfLink.removeAttribute('href');
    reportHtmlLink.removeAttribute('href');
    return;
  }

  reportPdfLink.href = buildArtifactUrl({ caseRef: data.caseRef, format: 'pdf', statusToken, email });
  reportHtmlLink.href = buildArtifactUrl({ caseRef: data.caseRef, format: 'html', statusToken, email });
  reportPdfLink.style.display = '';
  reportHtmlLink.style.display = '';
}

function renderOrder(data) {
  fieldCaseRef.textContent = data.caseRef || '—';
  fieldPackage.textContent = data.packageName || data.packageId || '—';
  fieldSubject.textContent = data.subjectName || '—';
  fieldJurisdiction.textContent = [data.county, data.state].filter(Boolean).join(', ') || '—';
  fieldStatus.textContent = statusLabel(data.status);
  fieldConfirmation.textContent = confirmationDeliveryLabel(data.payment_confirmation_email_status);
  fieldQueued.textContent = formatDateTime(data.queuedAt || data.createdAt);
  fieldAttempts.textContent = data.fulfillmentAttempts ?? '—';

  rowCompleted.style.display = data.completedAt ? '' : 'none';
  if (data.completedAt) fieldCompleted.textContent = formatDateTime(data.completedAt);

  const errorText = data.lastError || data.failure_reason || '';
  rowError.style.display = errorText ? '' : 'none';
  if (errorText) fieldError.textContent = errorText;

  setPill(data.status);
  updateTimeline(data.status);
  renderBrief(data);
  syncReportActions(data);
}

function clearPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function poll() {
  if (!caseRef || (!statusToken && !email)) {
    statusPill.textContent = 'ERROR';
    fieldStatus.textContent = 'Missing case reference — contact traceworks.tx@outlook.com with your payment receipt.';
    clearPolling();
    return;
  }

  try {
    const auth = statusToken
      ? `statusToken=${encodeURIComponent(statusToken)}`
      : `email=${encodeURIComponent(email)}`;
    const response = await fetch(`/api/get-order?caseRef=${encodeURIComponent(caseRef)}&${auth}`, {
      credentials: 'same-origin'
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      const order = data.order || data;
      renderOrder(order);
      if (TERMINAL_STATUSES.has(order.status)) clearPolling();
      return;
    }

    if (response.status === 404) {
      statusPill.className = 'status-pill default';
      statusPill.textContent = 'QUEUED';
      fieldCaseRef.textContent = caseRef;
      fieldStatus.textContent = 'Pending — check back in 30 seconds';
      return;
    }

    statusPill.textContent = 'UNAVAILABLE';
    fieldStatus.textContent = data.error || 'Status temporarily unavailable — your order is still processing.';
  } catch (error) {
    console.warn('TraceWorks success tracker could not poll the order status.', error);
    fieldStatus.textContent = 'Status service unavailable. If you are testing locally, make sure your API routes are running and reachable.';
  }
}

if (caseRef) fieldCaseRef.textContent = caseRef;

poll();
if (caseRef && (statusToken || email)) {
  pollInterval = setInterval(poll, 20_000);
}

window.addEventListener('beforeunload', clearPolling);
