const page = document.body.dataset.page;

// ── Admin key management ──────────────────────────────────────────────────────

function getKey() {
  return sessionStorage.getItem('tw_admin_key') || '';
}

function authHeaders() {
  const k = getKey();
  return k ? { 'x-admin-key': k } : {};
}

function renderKeyBanner() {
  const existing = document.getElementById('tw-key-banner');
  if (existing) return;
  const banner = document.createElement('div');
  banner.id = 'tw-key-banner';
  banner.style.cssText = 'background:#1a0a00;border:1px solid #5c3000;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#e0a060;display:flex;align-items:center;gap:10px;';
  banner.innerHTML = `<span><strong>Admin key required</strong> — enter key to load live data:</span>
    <input id="tw-key-input" type="password" placeholder="admin key" style="background:#0d0d0d;border:1px solid #5c3000;border-radius:4px;padding:4px 8px;color:#e0a060;font-size:12px;width:200px;" />
    <button id="tw-key-submit" style="background:#5c3000;border:none;border-radius:4px;padding:4px 10px;color:#fff;cursor:pointer;font-size:12px;">Load</button>`;
  document.querySelector('.tw-main')?.prepend(banner);
  document.getElementById('tw-key-submit')?.addEventListener('click', () => {
    const val = document.getElementById('tw-key-input')?.value?.trim();
    if (val) {
      sessionStorage.setItem('tw_admin_key', val);
      banner.remove();
      run();
    }
  });
}

async function fetchAdmin(path) {
  const res = await fetch(path, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.error || res.statusText), { status: res.status });
  }
  return res.json();
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function chipClass(v) {
  if (['healthy', 'high', 'paid', 'completed', 'ok', 'active'].includes(v)) return 'ok';
  if (['degraded', 'medium', 'running', 'analyst_review', 'warn', 'partial'].includes(v)) return 'warn';
  return 'danger';
}

function fmtCurrency(cents) {
  return cents != null ? `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
}

function errorRow(cols, msg) {
  return `<tr><td colspan="${cols}" style="color:#e05050;padding:12px;">${msg}</td></tr>`;
}

// ── Page renderers ────────────────────────────────────────────────────────────

async function renderDashboard() {
  if (!getKey()) { renderKeyBanner(); return; }

  const kpis = document.getElementById('kpis');
  const recentCases = document.getElementById('recent-cases');
  const srcHealth = document.getElementById('source-health');

  try {
    const [metrics, ordersData, health] = await Promise.all([
      fetchAdmin('/api/admin-metrics'),
      fetchAdmin('/api/admin-orders'),
      fetch('/api/health').then((r) => r.json()),
    ]);

    if (kpis) {
      const orders = ordersData.orders || [];
      const active = orders.filter((o) => !['completed', 'failed'].includes(o.status)).length;
      const rev = metrics.revenue30d != null ? fmtCurrency(metrics.revenue30d) : '—';
      const connectors = (health.envMissing || []).length === 0 ? 'all configured' : `${(health.envMissing || []).length} missing`;
      kpis.innerHTML = [
        ['Active Orders', active],
        ['Revenue (30d)', rev],
        ['Conversion (30d)', metrics.conversion30d != null ? `${metrics.conversion30d.toFixed(1)}%` : '—'],
        ['Source Connectors', connectors],
      ].map(([label, value]) =>
        `<article class="tw-card"><div class="tw-label">${label}</div><div class="tw-value">${value}</div></article>`
      ).join('');
    }

    if (recentCases) {
      const orders = (ordersData.orders || []).slice(0, 10);
      if (!orders.length) {
        recentCases.innerHTML = `<tr><td colspan="5" style="color:#888;padding:12px;">No orders found.</td></tr>`;
      } else {
        recentCases.innerHTML = orders.map((o) => `
          <tr>
            <td>${o.orderId || o.id || '—'}</td>
            <td>${o.subject || o.customerEmail || '—'}</td>
            <td><span class="tw-chip ${chipClass(o.status)}">${o.status}</span></td>
            <td>${o.packageId || '—'}</td>
            <td>${o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</td>
          </tr>`).join('');
      }
    }

    if (srcHealth) {
      const missing = health.envMissing || [];
      const SOURCE_ENV_MAP = getSourceEnvMap();
      srcHealth.innerHTML = SOURCE_ENV_MAP.map((s) => {
        const configured = !missing.includes(s.envKey);
        return `<tr><td>${s.name}</td><td>${s.category}</td>
          <td><span class="tw-chip ${configured ? 'ok' : 'danger'}">${configured ? 'configured' : 'not configured'}</span></td>
          <td>${s.coverage}</td></tr>`;
      }).join('');
    }
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      sessionStorage.removeItem('tw_admin_key');
      renderKeyBanner();
    }
    if (kpis) kpis.innerHTML = `<article class="tw-card" style="color:#e05050;">Failed to load metrics: ${e.message}</article>`;
  }
}

async function renderCases() {
  if (!getKey()) { renderKeyBanner(); return; }

  const target = document.getElementById('case-table-body');
  if (!target) return;

  try {
    const data = await fetchAdmin('/api/admin-orders');
    const orders = data.orders || [];

    if (!orders.length) {
      target.innerHTML = `<tr><td colspan="7" style="color:#888;padding:12px;">No orders found.</td></tr>`;
    } else {
      target.innerHTML = orders.map((o) => `
        <tr>
          <td>${o.orderId || o.id || '—'}</td>
          <td>${o.subject || o.customerEmail || '—'}</td>
          <td>${o.packageId || '—'}</td>
          <td><span class="tw-chip ${chipClass(o.status)}">${o.status}</span></td>
          <td>${o.county ? `${o.county}, ${o.state}` : (o.state || '—')}</td>
          <td>${o.sourcesFound != null ? `${o.sourcesFound}/${o.sourcesTotal ?? '?'}` : '—'}</td>
          <td>${o.confidence || '—'}</td>
        </tr>`).join('');
    }
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      sessionStorage.removeItem('tw_admin_key');
      renderKeyBanner();
    }
    target.innerHTML = errorRow(7, `Failed to load orders: ${e.message}`);
  }

  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tw-pane').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab)?.classList.add('active');
    });
  });
}

async function renderWorkflows() {
  const t = document.getElementById('workflow-defs');
  if (!t) return;

  try {
    const data = await fetch('/api/packages').then((r) => r.json());
    const packages = data.packages || [];
    if (!packages.length) {
      t.innerHTML = `<tr><td colspan="4" style="color:#888;padding:12px;">No packages found.</td></tr>`;
    } else {
      t.innerHTML = packages.map((p) => `
        <tr>
          <td>${p.id}</td>
          <td>${p.name}</td>
          <td>${p.sla || p.deliveryHours ? `${p.deliveryHours}h` : '—'}</td>
          <td>${p.sla || '—'}</td>
        </tr>`).join('');
    }
  } catch (e) {
    t.innerHTML = errorRow(4, `Failed to load packages: ${e.message}`);
  }
}

async function renderSources() {
  const t = document.getElementById('sources-registry');
  if (!t) return;

  try {
    const health = await fetch('/api/health').then((r) => r.json());
    const missing = health.envMissing || [];
    const SOURCE_ENV_MAP = getSourceEnvMap();
    t.innerHTML = SOURCE_ENV_MAP.map((s) => {
      const configured = !missing.includes(s.envKey);
      return `<tr>
        <td>${s.name}</td>
        <td>${s.category}</td>
        <td>${s.coverage}</td>
        <td><span class="tw-chip ${configured ? 'ok' : 'danger'}">${configured ? 'configured' : 'not configured'}</span></td>
      </tr>`;
    }).join('');
  } catch (e) {
    t.innerHTML = errorRow(4, `Failed to load source status: ${e.message}`);
  }
}

// ── Source connector metadata (env-key driven, no fake health values) ─────────

function getSourceEnvMap() {
  return [
    { name: 'Appraisal API',       envKey: 'APPRAISAL_API_URL',          category: 'Property',   coverage: 'County appraisal records' },
    { name: 'Tax Collector API',   envKey: 'TAX_COLLECTOR_API_URL',       category: 'Property',   coverage: 'Tax delinquency & assessments' },
    { name: 'Parcel GIS API',      envKey: 'PARCEL_GIS_API_URL',          category: 'Property',   coverage: 'Parcel geometry & ownership' },
    { name: 'County Clerk API',    envKey: 'COUNTY_CLERK_API_URL',        category: 'Court',      coverage: 'Deed & instrument index' },
    { name: 'Grantor/Grantee API', envKey: 'GRANTOR_GRANTEE_API_URL',     category: 'Court',      coverage: 'Chain of title index' },
    { name: 'Obituary API',        envKey: 'OBITUARY_API_URL',            category: 'Probate',    coverage: 'Obituary & death notice search' },
    { name: 'Probate API',         envKey: 'PROBATE_API_URL',             category: 'Probate',    coverage: 'Probate docket & filings' },
    { name: 'Public Records',      envKey: 'PUBLIC_RECORD_SOURCE_CONFIG', category: 'Locate',     coverage: 'Address, phone & identity records' },
  ];
}

// ── Router ────────────────────────────────────────────────────────────────────

function run() {
  ({ dashboard: renderDashboard, cases: renderCases, workflows: renderWorkflows, sources: renderSources }[page] || (() => {}))();
}

run();
