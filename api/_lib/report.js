/**
 * TraceWorks DynamicReportBuilder.
 *
 * RULES (non-negotiable):
 *  - Renders ONLY from WorkflowResults.sources — never infers or fabricates data
 *  - Every section shows its SourceResult status explicitly
 *  - Source Trace Panel mandatory at end of every report
 *  - Forbidden phrases scanned before delivery — throws if found
 *  - Tier-specific disclaimer appended
 */

import { CONFIDENCE, scanForForbiddenPhrases } from './schema.js';
import { getDisclaimer } from './disclaimers.js';
import { getPackage } from './packages.js';

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function confidenceLabel(confidence) {
  return CONFIDENCE[confidence] || CONFIDENCE.not_verified;
}

// ── SECTION RENDERER ─────────────────────────────────────────

function renderSourceSection(source) {
  switch (source.status) {
    case 'found':
    case 'partial': {
      const label    = source.status === 'partial' ? 'PARTIAL RESULT' : 'FOUND';
      const partial  = source.status === 'partial' ? `<p class="partial-note">PARTIAL RESULT — ${esc(source.errorDetail || '')}</p>` : '';
      const clabel   = confidenceLabel(source.confidence);
      const dataHtml = renderDataBlock(source);
      return `
        <section class="report-section">
          <h3>${esc(source.sourceLabel)} <span class="confidence ${source.confidence}">${esc(clabel)}</span></h3>
          <p class="meta-line">Source: <a href="${esc(source.sourceUrl)}" target="_blank" rel="noopener">${esc(source.sourceUrl)}</a> · Query: <em>${esc(source.queryUsed)}</em> · ${esc(source.queriedAt)}</p>
          ${partial}
          ${dataHtml}
        </section>`;
    }
    case 'not_found':
      return `
        <section class="report-section not-found">
          <h3>${esc(source.sourceLabel)} <span class="confidence not_found">${CONFIDENCE.not_found}</span></h3>
          <p class="meta-line">Source: <a href="${esc(source.sourceUrl)}" target="_blank" rel="noopener">${esc(source.sourceUrl)}</a> · Query: <em>${esc(source.queryUsed)}</em> · ${esc(source.queriedAt)}</p>
          <p class="status-block">NOT FOUND — ${esc(source.sourceLabel)} returned no results for query: <strong>${esc(source.queryUsed)}</strong>${source.errorDetail ? '. ' + esc(source.errorDetail) : ''}</p>
        </section>`;
    case 'unavailable':
    case 'blocked':
      return `
        <section class="report-section unavailable">
          <h3>${esc(source.sourceLabel)} <span class="confidence unavailable">${CONFIDENCE.manual_review}</span></h3>
          <p class="meta-line">Source: <a href="${esc(source.sourceUrl)}" target="_blank" rel="noopener">${esc(source.sourceUrl)}</a> · Query: <em>${esc(source.queryUsed)}</em> · ${esc(source.queriedAt)}</p>
          <p class="status-block">SOURCE UNAVAILABLE — ${esc(source.sourceLabel)} could not be accessed automatically. Reason: ${esc(source.errorDetail || source.status)}. Manual review recommended.</p>
        </section>`;
    case 'error':
    default:
      return `
        <section class="report-section error">
          <h3>${esc(source.sourceLabel)} <span class="confidence error">ERROR</span></h3>
          <p class="meta-line">Source: <a href="${esc(source.sourceUrl)}" target="_blank" rel="noopener">${esc(source.sourceUrl)}</a> · Query: <em>${esc(source.queryUsed)}</em> · ${esc(source.queriedAt)}</p>
          <p class="status-block">RETRIEVAL ERROR — ${esc(source.sourceLabel)} encountered an error: ${esc(source.errorDetail || 'Unknown error')}</p>
        </section>`;
  }
}

function renderDataBlock(source) {
  if (!source.data) return '<p class="no-data">No structured data captured.</p>';
  const d = source.data;

  // Property data from CAD
  if (d.properties) {
    const rows = d.properties.map((p) => `
      <tr>
        <td>${esc(p.ownerName)}</td>
        <td>${esc(p.situsAddress)}</td>
        <td>${esc(p.parcelId)}</td>
        <td>${esc(p.assessedValue)}</td>
        <td>${esc(p.taxYear)}</td>
        <td>${esc(p.propertyClass)}</td>
        <td>${esc(p.legalDesc)}</td>
      </tr>`).join('');
    return `<table class="data-table">
      <thead><tr><th>Owner of Record</th><th>Situs Address</th><th>Parcel/APN</th><th>Assessed Value</th><th>Tax Year</th><th>Class</th><th>Legal Description</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  // Entity data from TX SOS
  if (d.entities) {
    const rows = d.entities.map((e) => `<tr><td>${esc(e.entityName)}</td><td>${esc(e.status)}</td><td>${esc(e.entityType)}</td></tr>`).join('');
    return `<table class="data-table">
      <thead><tr><th>Entity Name</th><th>Status</th><th>Type</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  // People data (TruePeopleSearch, FastPeopleSearch)
  if (d.people) {
    return d.people.map((p, i) => `
      <div class="person-card">
        <strong>${esc(p.name || `Result ${i+1}`)}</strong>
        ${p.addresses?.length ? `<p>Addresses: ${p.addresses.map(esc).join(' · ')}</p>` : ''}
        ${p.phones?.length ? `<p>Phones: ${p.phones.map(esc).join(' · ')}</p>` : ''}
        ${p.relatives?.length ? `<p>Associated names: ${p.relatives.map(esc).join(', ')}</p>` : ''}
        ${p.confidence ? `<p class="conf">${confidenceLabel(p.confidence)}</p>` : ''}
      </div>`).join('');
  }

  // Obituary data
  if (d.obituaries) {
    return d.obituaries.map((o) => `
      <div class="obit-entry">
        <a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.title)}</a>
      </div>`).join('');
  }

  // DuckDuckGo results
  if (d.results) {
    return d.results.map((r) => `
      <div class="web-result">
        <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>
      </div>`).join('');
  }

  // Generic JSON fallback
  return `<pre class="json-block">${esc(JSON.stringify(d, null, 2))}</pre>`;
}

// ── SOURCE TRACE PANEL ────────────────────────────────────────

function buildSourceTracePanel(sources) {
  const rows = sources.map((s) => `
    <tr class="trace-${s.status}">
      <td>${esc(s.sourceLabel)}</td>
      <td>${esc(s.queryUsed)}</td>
      <td>${esc(s.queriedAt)}</td>
      <td><span class="trace-status ${s.status}">${esc(s.status.toUpperCase())}</span></td>
      <td>${esc(s.errorDetail || (s.data ? `${s.data.properties?.length || s.data.people?.length || s.data.entities?.length || s.data.results?.length || 1} record(s)` : '—'))}</td>
    </tr>`).join('');

  const total       = sources.length;
  const found       = sources.filter((s) => s.status === 'found').length;
  const partial     = sources.filter((s) => s.status === 'partial').length;
  const notFound    = sources.filter((s) => s.status === 'not_found').length;
  const unavailable = sources.filter((s) => s.status === 'unavailable' || s.status === 'blocked').length;
  const errors      = sources.filter((s) => s.status === 'error').length;

  return `
    <section class="source-trace-panel">
      <h2>SOURCE TRACE PANEL</h2>
      <p class="trace-note">Every source queried in this investigation — exact query, timestamp, and result. This table proves the work was done.</p>
      <table class="trace-table">
        <thead><tr><th>Source</th><th>Query Used</th><th>Timestamp</th><th>Status</th><th>Result Summary</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="trace-summary">
        SOURCES ATTEMPTED: <strong>${total}</strong> &nbsp;|&nbsp;
        FOUND: <strong>${found}</strong> &nbsp;|&nbsp;
        PARTIAL: <strong>${partial}</strong> &nbsp;|&nbsp;
        NOT FOUND: <strong>${notFound}</strong> &nbsp;|&nbsp;
        UNAVAILABLE: <strong>${unavailable}</strong> &nbsp;|&nbsp;
        ERRORS: <strong>${errors}</strong>
      </p>
    </section>`;
}

// ── HEIR CANDIDATE TABLE ──────────────────────────────────────

function buildHeirTable(heirCandidates) {
  if (!heirCandidates || heirCandidates.length === 0) return '';
  const rows = heirCandidates.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(c.name || '—')}</td>
      <td><span class="heir-rating ${c.heirRating}">${esc((c.heirRating || 'unknown').toUpperCase())}</span></td>
      <td>${(c.addresses || []).map(esc).join('<br>') || '—'}</td>
      <td>${(c.phones || []).map(esc).join('<br>') || '—'}</td>
      <td>${(c.relatives || []).map(esc).join(', ') || '—'}</td>
    </tr>`).join('');

  return `
    <section class="report-section heir-section">
      <h3>Heir Candidate Matrix</h3>
      <p class="meta-note">Candidates scored by name match, address presence, phone presence, and associated-name count.
      Labels are probabilistic only — not legal determinations. Every candidate requires manual legal verification.</p>
      <table class="data-table">
        <thead><tr><th>#</th><th>Name</th><th>Rating</th><th>Addresses</th><th>Phones</th><th>Associated Names</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

// ── MAIN HTML BUILDER ─────────────────────────────────────────

export function reportToHtml(workflowResults) {
  const {
    orderId, tier, startedAt, completedAt, inputs,
    sources = [], overallStatus, sourceSummary, heirCandidates,
    partialReasons = [], failureReasons = [],
  } = workflowResults;

  const pkg         = getPackage(tier) || {};
  const disclaimer  = getDisclaimer(tier, { timestamp: completedAt, orderId });
  const sections    = sources.map(renderSourceSection).join('');
  const tracePanel  = buildSourceTracePanel(sources);
  const heirTable   = buildHeirTable(heirCandidates);

  const statusClass = overallStatus === 'complete' ? 'complete' : overallStatus === 'partial' ? 'partial' : 'failed';
  const partialNote = partialReasons.length
    ? `<div class="partial-banner">PARTIAL REPORT — ${partialReasons.join('; ')}</div>` : '';
  const failNote    = failureReasons.length
    ? `<div class="fail-banner">FAILURE — ${failureReasons.join('; ')}</div>` : '';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>TraceWorks Report — ${esc(orderId)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#07090f;color:#dce4f8;font-family:'Inter',Arial,sans-serif;font-size:14px;line-height:1.6}
    .wrap{max-width:1100px;margin:24px auto;background:#0d1422;border:1px solid #1e2d4a;border-radius:16px;overflow:hidden}
    .hero{padding:32px 36px;background:linear-gradient(135deg,#060c1a 0%,#0f1e38 60%,#1a2a0a 100%);border-bottom:2px solid #c9a84c}
    .hero h1{font-size:28px;font-family:Georgia,serif;color:#f4f7ff;letter-spacing:1px}
    .hero .brand{color:#c9a84c;font-size:13px;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px}
    .hero-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:20px}
    .pill{background:#101a2e;border:1px solid #1e2d4a;border-radius:8px;padding:10px 14px}
    .pill .label{color:#7b8db0;font-size:11px;text-transform:uppercase;letter-spacing:1px}
    .pill .value{color:#f4f7ff;font-size:13px;font-weight:600;margin-top:2px}
    .status-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
    .status-badge.complete{background:#0a2e15;color:#38a169;border:1px solid #38a169}
    .status-badge.partial{background:#2e1a0a;color:#d97706;border:1px solid #d97706}
    .status-badge.failed{background:#2e0a0a;color:#e53e3e;border:1px solid #e53e3e}
    .body{padding:28px 36px}
    .partial-banner{background:#2e1a0a;border:1px solid #d97706;color:#d97706;padding:12px 16px;border-radius:8px;margin-bottom:20px;font-size:13px}
    .fail-banner{background:#2e0a0a;border:1px solid #e53e3e;color:#e53e3e;padding:12px 16px;border-radius:8px;margin-bottom:20px;font-size:13px}
    .report-section{background:#101a2e;border:1px solid #1e2d4a;border-radius:10px;padding:18px 20px;margin-bottom:16px}
    .report-section h3{font-size:16px;color:#c9a84c;font-family:Georgia,serif;margin-bottom:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .report-section.not-found{border-color:#1e2d1e;background:#0d1a0d}
    .report-section.unavailable{border-color:#2e2a10;background:#1a1608}
    .report-section.error{border-color:#2e1010;background:#1a0808}
    .meta-line{font-size:11px;color:#556b8a;margin-bottom:10px}
    .meta-line a{color:#7bafd4}
    .meta-note{font-size:12px;color:#556b8a;margin-bottom:12px;font-style:italic}
    .status-block{color:#a0b0c8;font-size:13px;background:#0a0f1e;padding:10px 14px;border-radius:6px;border-left:3px solid #2e4060}
    .partial-note{color:#d97706;font-size:12px;margin-bottom:8px}
    .no-data{color:#556b8a;font-style:italic;font-size:13px}
    .confidence{font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:0.5px}
    .confidence.confirmed{background:#0a2e15;color:#38a169}
    .confidence.likely{background:#0a1e2e;color:#4299e1}
    .confidence.possible{background:#1a1608;color:#d97706}
    .confidence.not_verified,.confidence.not_found{background:#1a1a1a;color:#718096}
    .confidence.unavailable,.confidence.manual_review,.confidence.error{background:#2e0a0a;color:#e53e3e}
    .data-table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
    .data-table th{background:#060c1a;color:#c9a84c;padding:8px 10px;text-align:left;border-bottom:1px solid #1e2d4a;font-weight:600;letter-spacing:0.5px}
    .data-table td{padding:7px 10px;border-bottom:1px solid #111e35;color:#b8c8e0;vertical-align:top}
    .data-table tr:last-child td{border-bottom:none}
    .person-card{background:#060c1a;border:1px solid #1e2d4a;border-radius:6px;padding:12px;margin-bottom:8px}
    .person-card strong{color:#e8f0ff;font-size:14px}
    .person-card p{color:#a0b0c8;font-size:12px;margin-top:4px}
    .person-card .conf{margin-top:6px}
    .obit-entry,.web-result{padding:6px 0;border-bottom:1px solid #111e35}
    .obit-entry a,.web-result a{color:#7bafd4;font-size:13px}
    .heir-section{}
    .heir-rating{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;text-transform:uppercase}
    .heir-rating.probable{background:#0a2e15;color:#38a169}
    .heir-rating.possible{background:#1a1608;color:#d97706}
    .heir-rating.low-confidence{background:#1a1a1a;color:#718096}
    .json-block{font-size:11px;color:#7b8db0;background:#060c1a;padding:10px;border-radius:6px;white-space:pre-wrap;word-break:break-all;max-height:200px;overflow:auto}
    /* Source Trace Panel */
    .source-trace-panel{margin-top:32px;padding:24px 0;border-top:2px solid #c9a84c}
    .source-trace-panel h2{color:#c9a84c;font-size:18px;font-family:Georgia,serif;letter-spacing:1px;margin-bottom:6px}
    .trace-note{font-size:12px;color:#556b8a;margin-bottom:14px;font-style:italic}
    .trace-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px}
    .trace-table th{background:#060c1a;color:#c9a84c;padding:8px 10px;text-align:left;border-bottom:1px solid #1e2d4a;font-weight:600}
    .trace-table td{padding:7px 10px;border-bottom:1px solid #111e35;color:#a0b0c8;vertical-align:top}
    .trace-status{font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;text-transform:uppercase}
    .trace-status.found{background:#0a2e15;color:#38a169}
    .trace-status.partial{background:#1a1608;color:#d97706}
    .trace-status.not_found{background:#1a1a1a;color:#718096}
    .trace-status.unavailable,.trace-status.blocked{background:#2e2a10;color:#d97706}
    .trace-status.error{background:#2e0a0a;color:#e53e3e}
    .trace-summary{font-size:12px;color:#7b8db0;margin-top:10px}
    .trace-summary strong{color:#c9a84c}
    /* Disclaimer */
    .disclaimer{margin-top:28px;padding:20px;background:#060c1a;border:1px solid #1e2d4a;border-radius:8px;color:#556b8a;font-size:11px;line-height:1.8;white-space:pre-wrap;font-family:monospace}
    .disclaimer-title{color:#c9a84c;font-size:12px;font-weight:700;margin-bottom:10px;letter-spacing:1px}
    /* Sections header */
    .sections-header{font-size:18px;color:#c9a84c;font-family:Georgia,serif;margin:24px 0 14px;padding-bottom:6px;border-bottom:1px solid #1e2d4a}
  </style>
</head>
<body>
<article class="wrap">
  <header class="hero">
    <div class="brand">TraceWorks™ Investigative Report</div>
    <h1>${esc(pkg.name || tier)}</h1>
    <div class="hero-meta">
      <div class="pill"><div class="label">Order ID</div><div class="value">${esc(orderId)}</div></div>
      <div class="pill"><div class="label">Subject</div><div class="value">${esc(inputs?.companyName || '—')}</div></div>
      <div class="pill"><div class="label">County / State</div><div class="value">${esc(inputs?.county || '—')} / ${esc(inputs?.state || '—')}</div></div>
      <div class="pill"><div class="label">Report Status</div><div class="value"><span class="status-badge ${statusClass}">${esc(overallStatus)}</span></div></div>
      <div class="pill"><div class="label">Generated</div><div class="value">${esc(completedAt)}</div></div>
      <div class="pill"><div class="label">Entity Detected</div><div class="value">${inputs?.entityDetected ? `YES — ${esc(inputs.entityType)}` : 'NO'}</div></div>
      <div class="pill"><div class="label">Sources Run</div><div class="value">${sourceSummary?.total || 0} (${sourceSummary?.found || 0} found)</div></div>
    </div>
  </header>

  <div class="body">
    ${partialNote}
    ${failNote}
    ${inputs?.goals ? `<div class="report-section"><h3>Investigation Objective</h3><p style="color:#b8c8e0;margin-top:6px">${esc(inputs.goals)}</p></div>` : ''}
    <h2 class="sections-header">Investigation Findings</h2>
    ${sections}
    ${heirTable}
    ${tracePanel}
    <div class="disclaimer">
      <div class="disclaimer-title">SCOPE LIMITATIONS & DISCLAIMER</div>
${esc(disclaimer)}

Report generated: ${esc(completedAt)} | Order ID: ${esc(orderId)} | TraceWorks™
    </div>
  </div>
</article>
</body>
</html>`;

  // Scan for forbidden phrases before returning
  const violations = scanForForbiddenPhrases(html);
  if (violations.length > 0) {
    throw new Error(`FORBIDDEN PHRASE DETECTED in report output: ${violations.join(', ')}. Report not delivered.`);
  }

  return html;
}

// ── PLAIN TEXT VERSION ────────────────────────────────────────

export function reportToText(workflowResults) {
  const { orderId, tier, completedAt, inputs, sources = [], overallStatus, sourceSummary, heirCandidates } = workflowResults;
  const pkg        = getPackage(tier) || {};
  const disclaimer = getDisclaimer(tier, { timestamp: completedAt, orderId });

  const lines = [
    'TRACEWORKS™ INVESTIGATIVE REPORT',
    '='.repeat(60),
    `Report Type:  ${pkg.name || tier}`,
    `Order ID:     ${orderId}`,
    `Subject:      ${inputs?.companyName || '—'}`,
    `County/State: ${inputs?.county || '—'} / ${inputs?.state || '—'}`,
    `Generated:    ${completedAt}`,
    `Status:       ${overallStatus.toUpperCase()}`,
    `Entity:       ${inputs?.entityDetected ? `YES — ${inputs.entityType}` : 'NO'}`,
    '',
    'INVESTIGATION FINDINGS',
    '─'.repeat(60),
  ];

  for (const s of sources) {
    lines.push('');
    lines.push(`[ ${s.sourceLabel} ]`);
    lines.push(`Status:    ${s.status.toUpperCase()} | Confidence: ${confidenceLabel(s.confidence)}`);
    lines.push(`URL:       ${s.sourceUrl}`);
    lines.push(`Query:     ${s.queryUsed}`);
    lines.push(`Timestamp: ${s.queriedAt}`);
    if (s.errorDetail) lines.push(`Note:      ${s.errorDetail}`);
    if (s.data?.properties) {
      lines.push('Properties found:');
      for (const p of s.data.properties) {
        lines.push(`  Owner: ${p.ownerName} | Address: ${p.situsAddress} | Parcel: ${p.parcelId} | Value: ${p.assessedValue}`);
      }
    }
    if (s.data?.people) {
      lines.push('People found:');
      for (const p of s.data.people) {
        lines.push(`  ${p.name} | Addrs: ${(p.addresses || []).join('; ')} | Phones: ${(p.phones || []).join('; ')}`);
      }
    }
    if (s.data?.entities) {
      lines.push('Entities found:');
      for (const e of s.data.entities) {
        lines.push(`  ${e.entityName} | ${e.status} | ${e.entityType}`);
      }
    }
  }

  if (heirCandidates?.length) {
    lines.push('', 'HEIR CANDIDATE MATRIX', '─'.repeat(40));
    for (const c of heirCandidates) {
      lines.push(`  ${c.name || '—'} | Rating: ${(c.heirRating || '').toUpperCase()} | Score: ${c.heirScore}`);
      if (c.addresses?.length) lines.push(`    Addresses: ${c.addresses.join(' | ')}`);
      if (c.phones?.length)    lines.push(`    Phones:    ${c.phones.join(' | ')}`);
    }
  }

  lines.push('');
  lines.push('SOURCE TRACE PANEL');
  lines.push('='.repeat(60));
  lines.push(`${'Source'.padEnd(30)} ${'Status'.padEnd(12)} Query`);
  lines.push('─'.repeat(80));
  for (const s of sources) {
    lines.push(`${(s.sourceLabel || '').padEnd(30)} ${(s.status || '').toUpperCase().padEnd(12)} ${s.queryUsed}`);
  }
  lines.push('');
  lines.push(`SOURCES: ${sourceSummary?.total || 0} | FOUND: ${sourceSummary?.found || 0} | NOT FOUND: ${sourceSummary?.notFound || 0} | UNAVAILABLE: ${sourceSummary?.unavailable || 0} | ERRORS: ${sourceSummary?.errors || 0}`);

  lines.push('');
  lines.push('─'.repeat(60));
  lines.push(disclaimer);
  lines.push(`Report generated: ${completedAt} | Order ID: ${orderId} | TraceWorks™`);

  return lines.join('\n');
}
