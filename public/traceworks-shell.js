import { graph, sourceRegistry, workflowDefinitions } from '/traceworks-data.js';

const page = document.body.dataset.page;

function chipClass(v) {
  if (['healthy', 'high', 'paid', 'completed'].includes(v)) return 'ok';
  if (['degraded', 'medium', 'running', 'analyst_review'].includes(v)) return 'warn';
  return 'danger';
}

function renderDashboard() {
  const k = document.getElementById('kpis');
  if (!k) return;
  const queued = graph.cases.filter((c) => c.workflow !== 'completed').length;
  // Revenue must not be computed from static demo data — load from /api/admin-metrics instead.
  k.innerHTML = [
    ['Active Cases (demo)', graph.cases.length],
    ['Queued Jobs (demo)', queued],
    ['Source Connectors (demo)', sourceRegistry.length],
    ['Revenue (30d)', '— load from /api/admin-metrics'],
  ].map(([label, value]) => `<article class="tw-card"><div class="tw-label">${label}</div><div class="tw-value" style="font-size:${String(value).startsWith('—') ? '13px' : ''}">${value}</div></article>`).join('');

  const recent = document.getElementById('recent-cases');
  if (recent) {
    recent.innerHTML = graph.cases.map((c) => `<tr><td>${c.id}</td><td>${c.subject}</td><td><span class="tw-chip ${chipClass(c.workflow)}">${c.workflow}</span></td><td>${c.sourcesFound}/${c.sourcesTotal}</td><td>${c.confidence}</td></tr>`).join('');
  }

  const src = document.getElementById('source-health');
  if (src) {
    src.innerHTML = sourceRegistry.map((s) => `<tr><td>${s.id}</td><td>${s.category}</td><td><span class="tw-chip ${chipClass(s.health)}">${s.health}</span></td><td>${s.freshness}</td></tr>`).join('');
  }
}

function renderCases() {
  const target = document.getElementById('case-table-body');
  if (!target) return;
  target.innerHTML = graph.cases.map((c) => `
    <tr>
      <td>${c.id}</td><td>${c.subject}</td><td>${c.packageId}</td>
      <td><span class="tw-chip ${chipClass(c.workflow)}">${c.workflow}</span></td>
      <td>${c.county}, ${c.state}</td><td>${c.sourcesFound}/${c.sourcesTotal}</td><td>${c.confidence}</td>
    </tr>`).join('');

  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tw-pane').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab)?.classList.add('active');
    });
  });
}

function renderWorkflows() {
  const t = document.getElementById('workflow-defs');
  if (!t) return;
  t.innerHTML = workflowDefinitions.map((w) => `<tr><td>${w.id}</td><td>${w.name}</td><td>$${(w.amount/100).toFixed(0)}</td><td>${w.steps}</td><td>${w.sla}</td></tr>`).join('');
}

function renderSources() {
  const t = document.getElementById('sources-registry');
  if (!t) return;
  t.innerHTML = sourceRegistry.map((s) => `<tr><td>${s.id}</td><td>${s.category}</td><td>${s.coverage}</td><td><span class="tw-chip ${chipClass(s.health)}">${s.health}</span></td></tr>`).join('');
}

({ dashboard: renderDashboard, cases: renderCases, workflows: renderWorkflows, sources: renderSources }[page] || (() => {}))();
