import { getMetrics, isDurableConfigured } from './_lib/store.js';
import { jsonWithRequestId } from './_lib/http.js';

const startedAt = new Date().toISOString();

export default async (event) => {
  const required = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'ADMIN_API_KEY'];
  if (String(process.env.PAID_FULFILLMENT_STRICT || 'true').toLowerCase() !== 'false') {
    required.push('APPRAISAL_API_URL', 'TAX_COLLECTOR_API_URL', 'PARCEL_GIS_API_URL', 'COUNTY_CLERK_API_URL', 'GRANTOR_GRANTEE_API_URL', 'OBITUARY_API_URL', 'PROBATE_API_URL', 'PUBLIC_RECORD_SOURCE_CONFIG');
  }
  const missing = required.filter((k) => !process.env[k]);
  const durableOk = isDurableConfigured();
  const metrics = await getMetrics();

  const warnings = [];
  if (!durableOk) {
    warnings.push(
      'TRACEWORKS_DURABLE_STORE is not set to "1" — checkout and webhook processing are BLOCKED. ' +
      'The file-based store is ephemeral on Netlify serverless: order records, webhook deduplication, ' +
      'and job queue state will not survive container restarts. ' +
      'Mount a persistent volume at TRACEWORKS_STORE_PATH (or migrate to an external database), ' +
      'then set TRACEWORKS_DURABLE_STORE=1 to enable live paid traffic.'
    );
  }

  return jsonWithRequestId(event, 200, {
    ok: missing.length === 0 && durableOk,
    durableStore: durableOk,
    service: 'traceworks',
    envMissing: missing,
    warnings,
    metrics,
    startedAt,
    now: new Date().toISOString(),
    version: process.env.COMMIT_REF || 'dev'
  });
};
