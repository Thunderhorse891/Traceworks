import { jsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { sendLeadNotificationEmail } from './_lib/email.js';
import { getBusinessEmail } from './_lib/business.js';

function safe(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

export default async (event) => {
  if (event.httpMethod !== 'POST') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `sales:${ip}`, windowMs: 60_000, max: 30 });
  if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests.' });

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonWithRequestId(event, 400, { error: 'Invalid JSON payload.' });
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
    return jsonWithRequestId(event, 400, { error: 'name, email, company, and monthlyCases are required.' });
  }
  if (!payload.email.includes('@')) return jsonWithRequestId(event, 400, { error: 'Valid email is required.' });

  const ownerEmail = getBusinessEmail();
  await sendLeadNotificationEmail({ ownerEmail, lead: payload });

  return jsonWithRequestId(event, 200, { ok: true, message: 'Lead submitted. We will respond shortly.' });
};
