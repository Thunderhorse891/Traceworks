import { getMetrics } from './_lib/store.js';
import { jsonWithRequestId } from './_lib/http.js';

const startedAt = new Date().toISOString();

export default async (event) => {
  const required = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter((k) => !process.env[k]);
  const metrics = await getMetrics();

  return jsonWithRequestId(event, 200, {
    ok: missing.length === 0,
    service: 'traceworks',
    envMissing: missing,
    metrics,
    startedAt,
    now: new Date().toISOString(),
    version: process.env.COMMIT_REF || 'dev'
  });
};
