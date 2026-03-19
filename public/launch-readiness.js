import { escapeHtml } from '/order-shared.js';

const overallEl = document.getElementById('overallStatus');
const overallTextEl = document.getElementById('overallStatusText');
const healthSummary = document.getElementById('healthSummary');
const missingEl = document.getElementById('missingList');
const sourceCatalogSummary = document.getElementById('sourceCatalogSummary');
const sourceGapList = document.getElementById('sourceGapList');
const metricsGrid = document.getElementById('metricsGrid');
const auditStatus = document.getElementById('auditStatus');
const auditStatusText = document.getElementById('auditStatusText');
const auditSummary = document.getElementById('auditSummary');
const auditChecks = document.getElementById('auditChecks');
const packageAuditWrap = document.getElementById('packageAuditWrap');
const packageAuditGrid = document.getElementById('packageAuditGrid');
const manualAuditWrap = document.getElementById('manualAuditWrap');
const manualAuditList = document.getElementById('manualAuditList');
const proofStatus = document.getElementById('proofStatus');
const proofStatusText = document.getElementById('proofStatusText');
const proofSummary = document.getElementById('proofSummary');
const proofForm = document.getElementById('sourceProofForm');
const proofResult = document.getElementById('proofResult');
const proofHistoryWrap = document.getElementById('proofHistoryWrap');
const proofHistoryList = document.getElementById('proofHistoryList');
const runProofBtn = document.getElementById('runProofBtn');
const dotStripe = document.getElementById('dot-stripe');
const dotSmtp = document.getElementById('dot-smtp');
const setAdminKeyBtn = document.getElementById('setAdminKeyBtn');
const clearAdminKeyBtn = document.getElementById('clearAdminKeyBtn');
const authHint = document.getElementById('authHint');

let adminSessionReady = false;

function syncAuthUi() {
  clearAdminKeyBtn.style.display = adminSessionReady ? '' : 'none';
  authHint.textContent = adminSessionReady
    ? 'Signed admin session is active for this browser. Detailed environment diagnostics and source proofs are enabled.'
    : 'Admin session unlocks missing env vars, source proofs, and live queue metrics.';
}

function setStatus(state, text) {
  overallEl.className = `status-indicator ${state}`;
  overallTextEl.textContent = text;
}

function setAuditStatus(state, text) {
  auditStatus.className = `status-indicator ${state}`;
  auditStatusText.textContent = text;
}

function setProofStatus(state, text) {
  proofStatus.className = `status-indicator ${state}`;
  proofStatusText.textContent = text;
}

async function authenticateAdmin() {
  const value = window.prompt('Paste ADMIN_API_KEY');
  if (!value || !value.trim()) return false;

  const response = await fetch('/api/admin-login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiKey: value.trim() })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Admin authentication failed.');
  adminSessionReady = true;
  syncAuthUi();
  return true;
}

async function logoutAdmin() {
  try {
    await fetch('/api/admin-logout', { method: 'POST', credentials: 'same-origin' });
  } catch {}
  adminSessionReady = false;
  syncAuthUi();
}

function metricCard(label, value) {
  const card = document.createElement('div');
  card.className = 'metric-card';
  const metricValue = document.createElement('div');
  metricValue.className = 'metric-value';
  metricValue.textContent = value ?? '—';
  const metricLabel = document.createElement('div');
  metricLabel.className = 'metric-label';
  metricLabel.textContent = label;
  card.appendChild(metricValue);
  card.appendChild(metricLabel);
  return card;
}

function auditCard(check) {
  const el = document.createElement('div');
  const border =
    check.status === 'fail'
      ? 'rgba(239,68,68,0.24)'
      : check.status === 'warn'
        ? 'rgba(245,158,11,0.24)'
        : 'rgba(120,160,220,0.16)';
  const badgeBg =
    check.status === 'fail'
      ? 'rgba(239,68,68,0.12)'
      : check.status === 'warn'
        ? 'rgba(245,158,11,0.12)'
        : 'rgba(34,197,94,0.12)';
  const badgeColor =
    check.status === 'fail'
      ? '#fca5a5'
      : check.status === 'warn'
        ? '#fcd34d'
        : '#86efac';

  const detail = escapeHtml(check.detail || '');
  const action = escapeHtml(check.action || '');
  const label = escapeHtml(check.label || '');
  const status = escapeHtml(check.status || '');
  const severity = escapeHtml(check.severity || '');

  el.style.border = `1px solid ${border}`;
  el.style.borderRadius = '16px';
  el.style.padding = '14px 16px';
  el.style.background = 'rgba(7,12,22,0.72)';
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
      <div>
        <div style="font-size:13px;color:var(--text-1);font-weight:600;">${label}</div>
        <div style="margin-top:6px;font-size:12px;color:var(--text-2);line-height:1.6;">${detail}</div>
        ${action ? `<div style="margin-top:8px;font-size:12px;color:var(--text-3);line-height:1.6;"><strong style="color:var(--text-2);">Action:</strong> ${action}</div>` : ''}
      </div>
      <span style="display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;background:${badgeBg};color:${badgeColor};font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${status} · ${severity}</span>
    </div>
  `;
  return el;
}

function packageCard(pkg) {
  const el = document.createElement('div');
  const ready = pkg.launchReady !== false;
  const border = ready ? 'rgba(34,197,94,0.24)' : 'rgba(245,158,11,0.24)';
  const badgeBg = ready ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)';
  const badgeColor = ready ? '#86efac' : '#fcd34d';
  const required = Array.isArray(pkg.requiredSourceCoverage) ? pkg.requiredSourceCoverage : [];

  el.style.border = `1px solid ${border}`;
  el.style.borderRadius = '16px';
  el.style.padding = '14px 16px';
  el.style.background = 'rgba(7,12,22,0.72)';
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
      <div>
        <div style="font-size:13px;color:var(--text-1);font-weight:600;">${escapeHtml(pkg.name || '')}</div>
        <div style="margin-top:6px;font-size:12px;color:var(--text-2);line-height:1.6;">${escapeHtml(pkg.readinessSummary || '')}</div>
        ${required.length ? `<div style="margin-top:8px;font-size:12px;color:var(--text-3);line-height:1.6;">Coverage: ${required.map((item) => `${escapeHtml(item.label)} (${item.ready ? 'ready' : 'missing'})`).join(' · ')}</div>` : ''}
      </div>
      <span style="display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;background:${badgeBg};color:${badgeColor};font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${ready ? 'ready' : 'blocked'}</span>
    </div>
  `;
  return el;
}

function proofHistoryCard(entry) {
  const el = document.createElement('div');
  el.className = 'proof-card';
  const tone = entry.ok ? '#86efac' : entry.launchBlocked ? '#fcd34d' : '#fca5a5';
  const label = entry.ok ? 'proved' : entry.launchBlocked ? 'blocked' : 'error';
  const location = [entry.county, entry.state].filter(Boolean).join(', ');
  const summary = entry.summary || {};
  const topSources = Array.isArray(entry.topSources) ? entry.topSources : [];

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
      <div>
        <div style="font-size:13px;color:var(--text-1);font-weight:600;">${escapeHtml(entry.packageName || entry.packageId || 'Proof run')} · ${escapeHtml(entry.subjectName || 'Unknown subject')}</div>
        <div style="margin-top:6px;font-size:12px;color:var(--text-3);line-height:1.6;">${escapeHtml(location || 'No jurisdiction')} · ${escapeHtml(entry.at ? new Date(entry.at).toLocaleString() : 'Unknown time')}</div>
        <div style="margin-top:8px;font-size:12px;color:var(--text-2);line-height:1.6;">Structured evidence: ${summary.totalStructuredEvidence || 0} · Open-web sources: ${summary.totalOpenWebSources || 0} · Providers with hits: ${summary.providersWithHits || 0}</div>
        ${(summary.publicRecordGaps || []).length ? `<div style="margin-top:8px;font-size:12px;color:#fcd34d;line-height:1.6;">Gaps: ${summary.publicRecordGaps.map((item) => escapeHtml(item)).join(' · ')}</div>` : ''}
        ${topSources.length ? `<div style="margin-top:8px;font-size:12px;color:var(--text-3);line-height:1.6;">Top sources: ${topSources.map((item) => escapeHtml(item.domain || item.provider || 'source')).join(' · ')}</div>` : ''}
      </div>
      <span style="display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;background:rgba(120,160,220,0.12);color:${tone};font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${label}</span>
    </div>
  `;
  return el;
}

async function loadLaunchAudit() {
  auditChecks.innerHTML = '';
  packageAuditGrid.innerHTML = '';
  packageAuditWrap.style.display = 'none';
  manualAuditList.innerHTML = '';
  manualAuditWrap.style.display = 'none';

  try {
    const response = await fetch('/api/launch-audit', { credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      adminSessionReady = false;
      syncAuthUi();
      setAuditStatus('warn', 'Admin Required');
      auditSummary.textContent = 'Authenticate admin to load the full launch audit. This endpoint is intentionally locked because it contains production launch findings.';
      return;
    }

    if (!response.ok) {
      setAuditStatus('error', 'Audit Error');
      auditSummary.textContent = data.error || 'Launch audit endpoint returned an error.';
      return;
    }

    adminSessionReady = true;
    syncAuthUi();

    const checks = Array.isArray(data.checks) ? data.checks : [];
    const packageReadiness = Array.isArray(data.packageReadiness) ? data.packageReadiness : [];
    const blockingCount = Number(data.blockingCount || 0);
    const warningCount = Number(data.warningCount || 0);
    const manualActions = Array.isArray(data.manualActions) ? data.manualActions : [];

    if (blockingCount === 0 && warningCount === 0) setAuditStatus('ok', 'Launch Clear');
    else if (blockingCount === 0) setAuditStatus('warn', `${warningCount} Warning${warningCount === 1 ? '' : 's'}`);
    else setAuditStatus('error', `${blockingCount} Blocker${blockingCount === 1 ? '' : 's'}`);

    auditSummary.textContent = blockingCount === 0
      ? `No blocking launch issues detected. ${warningCount ? `${warningCount} warning${warningCount === 1 ? '' : 's'} still deserve review.` : 'Automated checks are clean.'}`
      : `${blockingCount} blocking launch issue${blockingCount === 1 ? '' : 's'} detected. Resolve the failed blocking checks below before taking live paid traffic.`;

    checks.forEach((check) => auditChecks.appendChild(auditCard(check)));

    if (packageReadiness.length) {
      packageAuditWrap.style.display = 'block';
      packageReadiness.forEach((pkg) => packageAuditGrid.appendChild(packageCard(pkg)));
    }

    if (manualActions.length) {
      manualAuditWrap.style.display = 'block';
      manualActions.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        manualAuditList.appendChild(li);
      });
    }
  } catch {
    setAuditStatus('warn', 'Unreachable');
    auditSummary.textContent = 'Launch audit endpoint is unavailable. Confirm the local API server or deployed functions are running.';
  }
}

async function loadHealth() {
  try {
    const response = await fetch('/api/health', { credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus('error', 'Endpoint Error');
      healthSummary.textContent = data.error || 'Health endpoint returned an error.';
      return;
    }

    const missing = Array.isArray(data.envMissing) ? data.envMissing : [];
    const isPublic = data.visibility === 'public';
    const sourceConfigGaps = Array.isArray(data.sourceConfigGaps) ? data.sourceConfigGaps : [];
    const sourceConfigError = data.sourceConfigError || '';
    const sourceCatalog = data.sourceCatalog || null;

    missingEl.innerHTML = '';
    sourceGapList.innerHTML = '';
    sourceGapList.style.display = 'none';
    sourceCatalogSummary.style.display = 'none';
    sourceCatalogSummary.textContent = '';
    metricsGrid.innerHTML = '';
    metricsGrid.style.display = 'none';

    if (isPublic) {
      adminSessionReady = false;
      syncAuthUi();
      setStatus(data.ok ? 'ok' : 'warn', data.ok ? 'Public OK' : 'Public Limited');
      healthSummary.textContent = data.ok
        ? 'Public health check passed. Detailed environment diagnostics are hidden without admin authorization.'
        : 'Public health check is available, but detailed missing-variable diagnostics are hidden without admin authorization.';
    } else if (sourceConfigError) {
      adminSessionReady = true;
      syncAuthUi();
      setStatus('error', 'Source Config Error');
      healthSummary.textContent = sourceConfigError;
    } else if (sourceConfigGaps.length > 0) {
      adminSessionReady = true;
      syncAuthUi();
      setStatus('error', `${sourceConfigGaps.length} Source Gap${sourceConfigGaps.length > 1 ? 's' : ''}`);
      healthSummary.textContent = 'Source configuration is incomplete for strict fulfillment. The engine will refuse some paid workflows until these source families are configured:';
      sourceGapList.style.display = 'block';
      sourceConfigGaps.forEach((family) => {
        const li = document.createElement('li');
        li.textContent = family;
        sourceGapList.appendChild(li);
      });
    } else if (missing.length === 0) {
      adminSessionReady = true;
      syncAuthUi();
      setStatus('ok', 'All Clear');
      healthSummary.textContent = 'All required environment variables detected. System appears ready.';
    } else {
      adminSessionReady = true;
      syncAuthUi();
      setStatus('error', `${missing.length} Missing`);
      healthSummary.textContent = `${missing.length} required environment variable${missing.length > 1 ? 's' : ''} not set:`;
      missing.forEach((name) => {
        const li = document.createElement('li');
        li.textContent = name;
        missingEl.appendChild(li);
      });
    }

    const missingSet = new Set(missing);
    if (dotStripe) {
      dotStripe.className = `checklist-item-dot ${missingSet.has('STRIPE_SECRET_KEY') || missingSet.has('STRIPE_WEBHOOK_SECRET') ? 'error' : 'ok'}`;
    }
    if (dotSmtp) {
      dotSmtp.className = `checklist-item-dot ${missingSet.has('SMTP_HOST') || missingSet.has('SMTP_USER') || missingSet.has('SMTP_PASS') ? 'error' : 'ok'}`;
    }

    if (!isPublic && sourceCatalog) {
      sourceCatalogSummary.style.display = 'block';
      sourceCatalogSummary.textContent = `Source catalog: ${sourceCatalog.totalSources ?? '—'} configured sources across ${Object.keys(sourceCatalog.families || {}).length || 0} families (${sourceCatalog.mode || 'unknown'} mode), ${sourceCatalog.browserBackedSources ?? 0} browser-backed.`;
    }

    if (!isPublic && data.metrics) {
      metricsGrid.style.display = 'grid';
      const metrics = data.metrics;
      metricsGrid.appendChild(metricCard('Total Orders', metrics.ordersTotal ?? '—'));
      metricsGrid.appendChild(metricCard('Queue Depth', metrics.queueDepth ?? '—'));
      metricsGrid.appendChild(metricCard('Completed', metrics.byStatus?.completed ?? '—'));
      metricsGrid.appendChild(metricCard('Failed', metrics.byStatus?.failed ?? '—'));
      metricsGrid.appendChild(metricCard('Dead Letters', metrics.deadLetters ?? '—'));
      metricsGrid.appendChild(metricCard('Queue Age (s)', metrics.queueOldestMs != null ? Math.round(metrics.queueOldestMs / 1000) : '—'));
      metricsGrid.appendChild(metricCard('Configured Sources', sourceCatalog?.totalSources ?? '—'));
      metricsGrid.appendChild(metricCard('Browser-backed', sourceCatalog?.browserBackedSources ?? '—'));
    }
  } catch {
    setStatus('warn', 'Unreachable');
    healthSummary.textContent = 'Cannot reach /api/health. Confirm the local API server or deployed functions are running before using this checklist.';
  }
}

async function loadProofHistory() {
  proofHistoryList.innerHTML = '';
  proofHistoryWrap.style.display = 'none';

  if (!adminSessionReady) {
    setProofStatus('warn', 'Admin Required');
    proofSummary.textContent = 'Authenticate admin to run or review recorded source proofs.';
    return;
  }

  try {
    const response = await fetch('/api/source-proof?limit=5', { credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      adminSessionReady = false;
      syncAuthUi();
      setProofStatus('warn', 'Admin Required');
      proofSummary.textContent = 'Authenticate admin to run or review recorded source proofs.';
      return;
    }

    if (!response.ok) {
      setProofStatus('error', 'Proof Error');
      proofSummary.textContent = data.error || 'Source proof history could not be loaded.';
      return;
    }

    const proofs = Array.isArray(data.proofs) ? data.proofs : [];
    setProofStatus('ok', proofs.length ? `${proofs.length} Recorded` : 'Ready');
    proofSummary.textContent = proofs.length
      ? 'Recent real source-proof runs are listed below. Each entry came from the live workflow and was recorded for operator review.'
      : 'Admin session is ready. Run a live source proof with real identifiers to record the first validation entry.';

    if (proofs.length) {
      proofHistoryWrap.style.display = 'block';
      proofs.forEach((entry) => proofHistoryList.appendChild(proofHistoryCard(entry)));
    }
  } catch {
    setProofStatus('warn', 'Unreachable');
    proofSummary.textContent = 'Source proof history endpoint is unavailable right now.';
  }
}

async function runSourceProof(event) {
  event.preventDefault();
  if (!adminSessionReady) {
    setProofStatus('warn', 'Admin Required');
    proofSummary.textContent = 'Authenticate admin before running a live source proof.';
    return;
  }

  runProofBtn.disabled = true;
  runProofBtn.textContent = 'Running…';
  proofResult.style.display = 'none';
  proofResult.innerHTML = '';

  const payload = {
    packageId: document.getElementById('proofPackageId').value,
    subjectName: document.getElementById('proofSubjectName').value,
    subjectType: document.getElementById('proofSubjectType').value,
    county: document.getElementById('proofCounty').value,
    state: document.getElementById('proofState').value,
    lastKnownAddress: document.getElementById('proofAddress').value,
    parcelId: document.getElementById('proofParcelId').value,
    deathYear: document.getElementById('proofDeathYear').value
  };

  try {
    const response = await fetch('/api/source-proof', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      adminSessionReady = false;
      syncAuthUi();
      setProofStatus('warn', 'Admin Required');
      proofSummary.textContent = 'Authenticate admin before running a live source proof.';
      return;
    }

    if (response.status === 409) {
      setProofStatus('warn', 'Blocked');
      proofSummary.textContent = data.launchMessage || 'The requested source proof is blocked by current launch coverage rules.';
      proofResult.style.display = 'block';
      proofResult.className = 'proof-card';
      proofResult.innerHTML = `<div style="font-size:12px;color:#fcd34d;line-height:1.7;">${(data.blockingDetails || []).map((item) => `${escapeHtml(item.label)}: ${escapeHtml(item.detail)}`).join('<br>') || 'Coverage is not ready for this package and jurisdiction.'}</div>`;
      await loadProofHistory();
      return;
    }

    if (!response.ok) {
      setProofStatus('error', 'Proof Error');
      proofSummary.textContent = data.error || (data.errors || []).join(' ') || 'Source proof failed.';
      return;
    }

    const summary = data.summary || {};
    const topSources = Array.isArray(data.topSources) ? data.topSources : [];
    const providerHealth = Array.isArray(data.providerHealth) ? data.providerHealth : [];
    setProofStatus('ok', 'Proof Recorded');
    proofSummary.textContent = `Source proof recorded for ${data.packageName || data.packageId} in ${data.orderCoverage?.locationLabel || [data.input?.county, data.input?.state].filter(Boolean).join(', ')}.`;
    proofResult.style.display = 'block';
    proofResult.className = 'proof-card';
    proofResult.innerHTML = `
      <div style="font-size:13px;color:var(--text-1);font-weight:600;">${escapeHtml(data.packageName || data.packageId)} · ${escapeHtml(data.input?.subjectName || 'Unknown subject')}</div>
      <div style="margin-top:8px;font-size:12px;color:var(--text-2);line-height:1.7;">Structured evidence: ${summary.totalStructuredEvidence || 0} · Open-web sources: ${summary.totalOpenWebSources || 0} · Providers with hits: ${summary.providersWithHits || 0}</div>
      <div style="margin-top:8px;font-size:12px;color:var(--text-3);line-height:1.7;">${escapeHtml(data.providerNote || 'No provider note returned.')}</div>
      ${providerHealth.length ? `<div style="margin-top:10px;font-size:12px;color:var(--text-2);line-height:1.7;">Provider health: ${providerHealth.map((item) => `${escapeHtml(item.provider)} (${item.hitCount} hit${item.hitCount === 1 ? '' : 's'})`).join(' · ')}</div>` : ''}
      ${topSources.length ? `<div style="margin-top:10px;font-size:12px;color:var(--text-3);line-height:1.7;">Top sources: ${topSources.map((item) => escapeHtml(item.domain || item.provider || 'source')).join(' · ')}</div>` : ''}
      ${(summary.publicRecordGaps || []).length ? `<div style="margin-top:10px;font-size:12px;color:#fcd34d;line-height:1.7;">Gaps: ${summary.publicRecordGaps.map((item) => escapeHtml(item)).join(' · ')}</div>` : ''}
    `;
    await loadProofHistory();
  } catch {
    setProofStatus('warn', 'Unreachable');
    proofSummary.textContent = 'Source proof endpoint is unavailable right now.';
  } finally {
    runProofBtn.disabled = false;
    runProofBtn.textContent = 'Run Source Proof';
  }
}

async function refreshAll() {
  await loadHealth();
  await loadLaunchAudit();
  await loadProofHistory();
}

setAdminKeyBtn.addEventListener('click', async () => {
  try {
    const ok = await authenticateAdmin();
    if (!ok) return;
    await refreshAll();
  } catch (error) {
    authHint.textContent = error.message || 'Admin authentication failed.';
  }
});

clearAdminKeyBtn.addEventListener('click', async () => {
  await logoutAdmin();
  await refreshAll();
});

proofForm.addEventListener('submit', runSourceProof);

syncAuthUi();
refreshAll();
