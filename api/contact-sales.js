import { sendJsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { sendLeadNotificationEmail } from './_lib/email.js';
import { getBusinessEmail } from './_lib/business.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safe(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJsonWithRequestId(req, res, 405, { error: 'Method not allowed' });

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || '');
  if (Buffer.byteLength(rawBody, 'utf8') > 100_000) {
    return sendJsonWithRequestId(req, res, 413, { error: 'Payload too large.' });
  }

  const ip = req.headers['x-forwarded-for'] || req.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `sales:${ip}`, windowMs: 60_000, max: 30 });
  if (limit.limited) return sendJsonWithRequestId(req, res, 429, { error: 'Too many requests.' });

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return sendJsonWithRequestId(req, res, 400, { error: 'Invalid JSON payload.' });
  }

  // Honeypot — bots fill the website field
  if (safe(body.website, 60)) {
    return sendJsonWithRequestId(req, res, 200, { ok: true });
  }

  const payload = {
    name: safe(body.name, 120),
    email: safe(body.email, 160).toLowerCase(),
    company: safe(body.company, 160),
    monthlyCases: safe(body.monthlyCases, 40),
    budget: safe(body.budget, 80),
    message: safe(body.message, 1200)
  };

  if (!payload.name || !payload.email || !payload.company || !payload.monthlyCases) {
    return sendJsonWithRequestId(req, res, 400, {
      error: 'name, email, company, and monthlyCases are required.'
    });
  }
  if (!EMAIL_RE.test(payload.email)) {
    return sendJsonWithRequestId(req, res, 400, { error: 'Valid email is required.' });
  }

  const ownerEmail = getBusinessEmail();
  await sendLeadNotificationEmail({ ownerEmail, lead: payload });

  return sendJsonWithRequestId(req, res, 200, {
    ok: true,
    message: 'Lead submitted. We will respond shortly.'
  });
}
