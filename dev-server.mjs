/**
 * TraceWorks local dev server — zero npm dependencies.
 * Serves public/ as static files and mocks API routes.
 * Usage: node dev-server.mjs [port]
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2]) || 3000;
const PUBLIC = path.join(__dirname, 'public');

// ── MIME types ────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff2':'font/woff2',
};

// ── Mock API responses ────────────────────────────────────────
// These return plausible shapes so the frontend renders cleanly.
// No real processing — for local preview only.

function mockOrder(caseRef) {
  return {
    caseRef: caseRef || 'TW-PREVIEW-0001',
    status: 'processing',
    packageId: 'comprehensive',
    packageName: 'Comprehensive Locate + Assets',
    createdAt: new Date().toISOString(),
    queuedAt: new Date().toISOString(),
    fulfillmentAttempts: 1,
  };
}

const API_HANDLERS = {
  // Order status lookup — returns a mock processing order
  'GET /api/get-order': (req, url) => {
    const caseRef = url.searchParams.get('caseRef') || 'TW-PREVIEW-0001';
    return [200, mockOrder(caseRef)];
  },

  // Checkout creation — returns a mock Stripe URL so the form doesn't break
  'POST /api/create-checkout': (req, body) => {
    const ref = `TW-PREVIEW-${Date.now().toString(36).toUpperCase()}`;
    return [200, {
      checkoutUrl: `javascript:alert('Preview mode: Stripe checkout disabled. Case ref would be ${ref}')`,
      caseRef: ref,
      statusToken: 'preview-token',
    }];
  },

  // Admin metrics
  'GET /api/admin-metrics': () => [200, {
    totalOrders: 12,
    totalRevenue: 4250,
    queueDepth: 2,
    failedJobs: 0,
    byStatus: { queued: 1, processing: 1, completed: 8, failed: 0, retrying: 0, checkout_created: 2 },
    health: 'healthy',
  }],

  // Admin orders list
  'GET /api/admin-orders': () => [200, {
    orders: [
      { caseRef: 'TW-26031-A4K9', packageId: 'comprehensive',        status: 'processing',    createdAt: new Date(Date.now() - 3600000).toISOString(), amountTotal: 54900, fulfillmentAttempts: 1 },
      { caseRef: 'TW-26030-B7M2', packageId: 'ownership_encumbrance', status: 'analyst_review',createdAt: new Date(Date.now() - 7200000).toISOString(), amountTotal: 24900, fulfillmentAttempts: 1 },
      { caseRef: 'TW-26029-C3X5', packageId: 'standard',              status: 'completed',     createdAt: new Date(Date.now() - 86400000).toISOString(), amountTotal: 9900, fulfillmentAttempts: 1 },
    ],
  }],

  // Health check
  'GET /api/health': () => [200, { status: 'ok', timestamp: new Date().toISOString() }],

  // Analytics event tracking — always succeeds
  'POST /api/track-event': () => [200, { ok: true }],

  // Contact/sales form
  'POST /api/contact-sales': () => [200, { ok: true, message: 'Inquiry received.' }],

  // Report preview — returns a minimal preview HTML
  'GET /api/report-preview': (req, url) => {
    const pkg = url.searchParams.get('packageId') || 'standard';
    const html = `<!doctype html><html><head><meta charset="UTF-8"><title>Preview</title>
      <style>body{background:#07090f;color:#dce4f8;font-family:Inter,sans-serif;padding:32px}
      .banner{background:#1a2a0a;border:1px solid #c9a84c;color:#c9a84c;padding:10px 16px;margin-bottom:24px;font-size:12px;letter-spacing:1px;text-transform:uppercase}
      </style></head><body>
      <div class="banner">Report Preview — ${pkg} — Preview Mode (API mocked)</div>
      <p style="color:#7b8db0">This is a local preview. Real report generation requires the full backend stack with KV store and SMTP configured.</p>
      </body></html>`;
    return [200, html, 'text/html; charset=utf-8'];
  },
};

// ── Request body reader ───────────────────────────────────────
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

// ── Static file server ────────────────────────────────────────
function serveStatic(res, reqPath) {
  // Resolve path — strip query string
  const clean = reqPath.split('?')[0];

  // Try exact path, then .html extension, then index.html
  const candidates = [
    path.join(PUBLIC, clean),
    path.join(PUBLIC, clean + '.html'),
    path.join(PUBLIC, clean, 'index.html'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const ext  = path.extname(candidate);
      const mime = MIME[ext] || 'application/octet-stream';
      const data = fs.readFileSync(candidate);
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
      res.end(data);
      return true;
    }
  }
  return false;
}

// ── Main server ───────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url    = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method.toUpperCase();
  const reqPath = url.pathname;

  // Security headers (mirrors api/_lib/http.js)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  // ── API routes ──
  if (reqPath.startsWith('/api/')) {
    const key = `${method} ${reqPath}`;
    const handler = API_HANDLERS[key];
    if (handler) {
      const body   = method === 'POST' ? await readBody(req) : {};
      const result = handler(req, url, body);
      const [status, payload, contentType] = result;
      if (typeof payload === 'string') {
        res.writeHead(status, { 'Content-Type': contentType || 'text/plain' });
        res.end(payload);
      } else {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...payload, _preview: true }));
      }
      return;
    }
    // Unknown API route
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not implemented in preview mode', path: reqPath }));
    return;
  }

  // ── Static files ──
  if (!serveStatic(res, reqPath)) {
    // Fall back to index.html for SPA-style navigation
    const index = path.join(PUBLIC, 'index.html');
    if (fs.existsSync(index)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(index));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  TraceWorks dev server running');
  console.log('');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Public:  ${PUBLIC}`);
  console.log('');
  console.log('  Key pages:');
  console.log(`    Landing page   → http://localhost:${PORT}/`);
  console.log(`    Report tiers   → http://localhost:${PORT}/report-tiers.html`);
  console.log(`    Sample reports → http://localhost:${PORT}/reports/report-locate.html`);
  console.log(`                     http://localhost:${PORT}/reports/report-comprehensive.html`);
  console.log(`                     http://localhost:${PORT}/reports/report-title.html`);
  console.log(`                     http://localhost:${PORT}/reports/report-heir.html`);
  console.log(`    Console        → http://localhost:${PORT}/console.html`);
  console.log(`    Matters        → http://localhost:${PORT}/cases.html`);
  console.log(`    My Matters     → http://localhost:${PORT}/dashboard.html`);
  console.log(`    Order success  → http://localhost:${PORT}/success.html`);
  console.log(`    Admin          → http://localhost:${PORT}/admin-dashboard.html`);
  console.log('');
  console.log('  API routes are mocked. Stripe, KV, and SMTP are disabled in preview.');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`  Port ${PORT} is already in use. Try: node dev-server.mjs ${PORT + 1}`);
  } else {
    console.error('  Server error:', err.message);
  }
  process.exit(1);
});
