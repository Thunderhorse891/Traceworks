import { getMetrics } from './_lib/store.js';
import { sendJsonWithRequestId } from './_lib/http.js';

const startedAt = new Date().toISOString();

export default async function handler(req, res) {
  const required = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter((k) => !process.env[k]);
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
