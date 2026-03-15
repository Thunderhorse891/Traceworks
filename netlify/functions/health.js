import { getMetrics } from './_lib/store.js';
import { missingEmailConfigKeys } from './_lib/email-config.js';
import { jsonWithRequestId } from './_lib/http.js';
import { missingKvConfigKeys, storageDriverName } from './_lib/storage-runtime.js';
import { findStrictSourceConfigGaps, loadSourceConfig, summarizeSourceConfig } from './_lib/sources/source-config.js';
import { auditLaunchReadiness } from './_lib/launch-audit.js';

const startedAt = new Date().toISOString();

export default async (event) => {
  if (event.httpMethod !== 'GET') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  const strictFulfillment = String(process.env.PAID_FULFILLMENT_STRICT || 'true').toLowerCase() !== 'false';
  const required = [
    'URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'ADMIN_API_KEY',
    'STATUS_TOKEN_SECRET',
    'QUEUE_CRON_SECRET',
    'APPRAISAL_API_URL',
    'TAX_COLLECTOR_API_URL',
    'PARCEL_GIS_API_URL',
    'COUNTY_CLERK_API_URL',
    'GRANTOR_GRANTEE_API_URL',
    'MORTGAGE_INDEX_API_URL',
    'OBITUARY_API_URL',
    'PROBATE_API_URL',
    'PEOPLE_ASSOC_API_URL'
  ];
  if (strictFulfillment) {
    const peopleLicensed = String(process.env.PEOPLE_ASSOC_LICENSED || '').trim().toLowerCase() === 'true';
    if (!peopleLicensed) required.push('PEOPLE_ASSOC_LICENSED');
  }
  const storageDriver = storageDriverName();
  if (storageDriver === 'kv') {
    required.push(...missingKvConfigKeys());
  }
  const missing = [...new Set([
    ...required.filter((k) => !process.env[k]),
    ...missingEmailConfigKeys(process.env)
  ])];
  const sourceConfigMode = String(process.env.PUBLIC_RECORD_SOURCE_CONFIG || '').trim() ? 'env' : 'default';
  let sourceCatalog = null;
  let sourceConfigGaps = [];
  let sourceConfigError = null;

  try {
    const sourceConfig = loadSourceConfig(process.env);
    sourceCatalog = {
      mode: sourceConfigMode,
      ...summarizeSourceConfig(sourceConfig)
    };
    if (strictFulfillment) {
      sourceConfigGaps = findStrictSourceConfigGaps(sourceConfig);
    }
  } catch (error) {
    sourceConfigError = String(error?.message || error || 'Unknown source config error');
  }

  const auth = event.headers.authorization || '';
  const key = process.env.ADMIN_API_KEY;
  const launchAudit = auditLaunchReadiness(process.env);

  const payload = {
    ok: launchAudit.ok && missing.length === 0 && !sourceConfigError && sourceConfigGaps.length === 0,
    service: 'traceworks',
    strictFulfillment,
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
    metrics,
    sourceCatalog,
    sourceConfigGaps,
    sourceConfigError
  });
};
