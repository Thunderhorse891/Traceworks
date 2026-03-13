import { getMetrics } from './_lib/store.js';
import { jsonWithRequestId } from './_lib/http.js';

const startedAt = new Date().toISOString();

export default async (event) => {
  const required = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'ADMIN_API_KEY'];
  if (String(process.env.PAID_FULFILLMENT_STRICT || 'true').toLowerCase() !== 'false') {
    required.push('APPRAISAL_API_URL', 'TAX_COLLECTOR_API_URL', 'PARCEL_GIS_API_URL', 'COUNTY_CLERK_API_URL', 'GRANTOR_GRANTEE_API_URL', 'OBITUARY_API_URL', 'PROBATE_API_URL', 'PUBLIC_RECORD_SOURCE_CONFIG');
  }
  const missing = required.filter((k) => !process.env[k]);
  const metrics = await getMetrics();

  const warnings = [];
  if (!process.env.TRACEWORKS_STORE_PATH) {
    warnings.push('TRACEWORKS_STORE_PATH is not set — using default .data/traceworks-store.json which is ephemeral on Netlify serverless. Orders will not survive function restarts. Set TRACEWORKS_STORE_PATH to a persistent volume path or migrate to an external database.');
  }

  return jsonWithRequestId(event, 200, {
    ok: missing.length === 0,
    service: 'traceworks',
    envMissing: missing,
    warnings,
    metrics,
    startedAt,
    now: new Date().toISOString(),
    version: process.env.COMMIT_REF || 'dev'
  });
};
