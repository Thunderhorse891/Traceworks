import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPaidOrderLaunchGate } from '../netlify/functions/_lib/launch-audit.js';

function restoreEnv(snapshot, keys) {
  for (const key of keys) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

test('paid-order launch gate blocks checkout when launch requirements are missing', async () => {
  const keys = [
    'URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'ADMIN_API_KEY',
    'STATUS_TOKEN_SECRET',
    'QUEUE_CRON_SECRET',
    'TRACEWORKS_STORAGE_DRIVER',
    'APPRAISAL_API_URL',
    'TAX_COLLECTOR_API_URL',
    'PARCEL_GIS_API_URL',
    'COUNTY_CLERK_API_URL',
    'GRANTOR_GRANTEE_API_URL',
    'MORTGAGE_INDEX_API_URL',
    'OBITUARY_API_URL',
    'PROBATE_API_URL',
    'PEOPLE_ASSOC_API_URL',
    'PEOPLE_ASSOC_LICENSED',
    'PUBLIC_RECORD_SOURCE_CONFIG'
  ];
  const snapshot = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  try {
    for (const key of keys) delete process.env[key];
    process.env.TRACEWORKS_STORAGE_DRIVER = 'file';

    const gate = assessPaidOrderLaunchGate(process.env);
    assert.equal(gate.ok, false);
    assert.equal(typeof gate.publicMessage, 'string');
    assert.ok(gate.publicMessage.includes('temporarily not accepting paid orders'));
    assert.ok(Array.isArray(gate.reasonCodes));
    assert.ok(gate.reasonCodes.length >= 1);
    assert.ok(gate.blockingChecks.some((check) => check.id === 'storage_driver'));
  } finally {
    restoreEnv(snapshot, keys);
  }
});
