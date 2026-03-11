import { getMetrics } from './_lib/store.js';
import { sendJsonWithRequestId } from './_lib/http.js';

const startedAt = new Date().toISOString();

export default async function handler(req, res) {
  const missing = [];

  const required = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SMTP_HOST'];
  for (const k of required) {
    if (!process.env[k]) missing.push(k);
  }

  // Accept both SMTP_USER / SMTP_USERNAME and SMTP_PASS / SMTP_PASSWORD
  if (!process.env.SMTP_USER && !process.env.SMTP_USERNAME) {
    missing.push('SMTP_USER');
  }
  if (!process.env.SMTP_PASS && !process.env.SMTP_PASSWORD) {
    missing.push('SMTP_PASS');
  }

  const metrics = await getMetrics();

  return sendJsonWithRequestId(req, res, 200, {
    ok: missing.length === 0,
    service: 'traceworks',
    envMissing: missing,
    metrics,
    startedAt,
    now: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || process.env.COMMIT_REF || 'dev'
  });
}
