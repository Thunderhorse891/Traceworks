import { getMetrics } from './_lib/store.js';
import { jsonWithRequestId } from './_lib/http.js';
import { missingKvConfigKeys, storageDriverName } from './_lib/storage-runtime.js';

const startedAt = new Date().toISOString();

export default async (event) => {
  if (event.httpMethod !== 'GET') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  const required = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'ADMIN_API_KEY'];
  if (String(process.env.PAID_FULFILLMENT_STRICT || 'true').toLowerCase() !== 'false') {
    required.push('APPRAISAL_API_URL', 'TAX_COLLECTOR_API_URL', 'PARCEL_GIS_API_URL', 'COUNTY_CLERK_API_URL', 'GRANTOR_GRANTEE_API_URL', 'OBITUARY_API_URL', 'PROBATE_API_URL', 'PUBLIC_RECORD_SOURCE_CONFIG');
  }
  const storageDriver = storageDriverName();
  if (storageDriver === 'kv') {
    required.push(...missingKvConfigKeys());
  }
  const missing = [...new Set(required.filter((k) => !process.env[k]))];
  const auth = event.headers.authorization || '';
  const key = process.env.ADMIN_API_KEY;

  const payload = {
    ok: missing.length === 0,
    service: 'traceworks',
    storageDriver,
    startedAt,
    now: new Date().toISOString(),
    version: process.env.COMMIT_REF || 'dev'
  };

  if (!key || auth !== `Bearer ${key}`) {
    return jsonWithRequestId(event, 200, { ...payload, visibility: 'public' });
  }

  const metrics = await getMetrics();

  return jsonWithRequestId(event, 200, {
    ...payload,
    visibility: 'admin',
    envMissing: missing,
    metrics
  });
};
