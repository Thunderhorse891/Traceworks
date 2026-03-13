import { getMetrics } from './_lib/store.js';
import { sendJsonWithRequestId } from './_lib/http.js';

const startedAt = new Date().toISOString();

export default async function handler(req, res) {
  const required = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'ADMIN_API_KEY',
  ];

  if (String(process.env.PAID_FULFILLMENT_STRICT || 'true').toLowerCase() !== 'false') {
    required.push(
      'APPRAISAL_API_URL',
      'TAX_COLLECTOR_API_URL',
      'PARCEL_GIS_API_URL',
      'COUNTY_CLERK_API_URL',
      'GRANTOR_GRANTEE_API_URL',
      'OBITUARY_API_URL',
      'PROBATE_API_URL',
      'PUBLIC_RECORD_SOURCE_CONFIG'
    );
  }

  const missing = required.filter((k) => !process.env[k]);
  const persistenceMissing = ['KV_REST_API_URL', 'KV_REST_API_TOKEN'].filter((k) => !process.env[k]);
  const warnings = [];

  if (persistenceMissing.length > 0) {
    warnings.push('Vercel KV persistence is not fully configured.');
  }

  const metrics = await getMetrics();

  return sendJsonWithRequestId(req, res, 200, {
    ok: missing.length === 0 && persistenceMissing.length === 0,
    service: 'traceworks',
    envMissing: missing,
    persistenceMissing,
    warnings,
    metrics,
    startedAt,
    now: new Date().toISOString(),
    version: process.env.COMMIT_REF || 'dev',
  });
}
