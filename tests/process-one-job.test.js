import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const LAUNCH_GATE_KEYS = [
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
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
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

function snapshotEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot, keys) {
  for (const key of keys) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

function setLaunchReadyEnv() {
  process.env.URL = 'https://traceworks.example.com';
  process.env.STRIPE_SECRET_KEY = 'sk_live_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_USER = 'smtp-user';
  process.env.SMTP_PASS = 'smtp-pass';
  process.env.ADMIN_API_KEY = 'admin-secret';
  process.env.STATUS_TOKEN_SECRET = 'status-secret';
  process.env.QUEUE_CRON_SECRET = 'queue-secret';
  process.env.TRACEWORKS_STORAGE_DRIVER = 'kv';
  process.env.UPSTASH_REDIS_REST_URL = 'https://kv.example.com';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'kv-secret';
  process.env.APPRAISAL_API_URL = 'https://sources.example/appraisal';
  process.env.TAX_COLLECTOR_API_URL = 'https://sources.example/tax';
  process.env.PARCEL_GIS_API_URL = 'https://sources.example/gis';
  process.env.COUNTY_CLERK_API_URL = 'https://sources.example/clerk';
  process.env.GRANTOR_GRANTEE_API_URL = 'https://sources.example/grantor';
  process.env.MORTGAGE_INDEX_API_URL = 'https://sources.example/mortgage';
  process.env.OBITUARY_API_URL = 'https://sources.example/obits';
  process.env.PROBATE_API_URL = 'https://sources.example/probate';
  process.env.PEOPLE_ASSOC_API_URL = 'https://sources.example/people';
  process.env.PEOPLE_ASSOC_LICENSED = 'true';
  process.env.PUBLIC_RECORD_SOURCE_CONFIG = JSON.stringify({
    countyProperty: [{ id: 'property', type: 'html' }],
    countyRecorder: [{ id: 'recorder', type: 'html' }],
    probateIndex: [{ id: 'probate', type: 'html' }],
    entitySearch: [{ id: 'entity', type: 'json' }]
  });
}

test('processOneFulfillmentJob preserves manual review status written by fulfillment', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tw-job-'));
  process.env.TRACEWORKS_STORE_PATH = join(dir, 'store.json');
  const envSnapshot = snapshotEnv(LAUNCH_GATE_KEYS);
  for (const key of LAUNCH_GATE_KEYS) delete process.env[key];
  process.env.TRACEWORKS_STORAGE_DRIVER = 'file';

  try {
    const stamp = Date.now();
    const store = await import(`../netlify/functions/_lib/store.js?ts=${stamp}`);
    const { processOneFulfillmentJob } = await import(`../netlify/functions/_lib/process-one-job.js?ts=${stamp}`);

    const caseRef = 'TW-JOB-1';
    await store.upsertOrder(caseRef, {
      order_id: caseRef,
      caseRef,
      status: 'queued',
      customerEmail: 'client@example.com',
    });
    await store.enqueueJob({
      type: 'fulfillment',
      payload: { caseRef, packageId: 'standard' },
    });

    const result = await processOneFulfillmentJob({
      ownerEmail: 'owner@example.com',
      deps: {
        assessPackageLaunchGateImpl: () => ({ launchReady: true, launchBlockingDetails: [] }),
        processFulfillmentJobImpl: async () => {
          await store.upsertOrder(caseRef, {
            status: 'manual_review',
            completed_at: new Date().toISOString(),
          });
          return { workflow: { overallStatus: 'partial' } };
        },
      },
    });

    assert.equal(result.ok, true);
    const order = await store.getOrder(caseRef);
    assert.equal(order.status, 'manual_review');
    assert.ok(order.lastProcessedAt);
  } finally {
    restoreEnv(envSnapshot, LAUNCH_GATE_KEYS);
    await rm(dir, { recursive: true, force: true });
  }
});

test('processOneFulfillmentJob routes queued work to manual review when launch gate is blocked', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tw-job-gate-'));
  process.env.TRACEWORKS_STORE_PATH = join(dir, 'store.json');

  const snapshot = snapshotEnv(LAUNCH_GATE_KEYS);
  for (const key of LAUNCH_GATE_KEYS) delete process.env[key];
  process.env.TRACEWORKS_STORAGE_DRIVER = 'file';

  try {
    const stamp = Date.now();
    const store = await import(`../netlify/functions/_lib/store.js?ts=${stamp}`);
    const { processOneFulfillmentJob } = await import(`../netlify/functions/_lib/process-one-job.js?ts=${stamp}`);

    const caseRef = 'TW-JOB-GATE';
    await store.upsertOrder(caseRef, {
      order_id: caseRef,
      caseRef,
      status: 'queued',
      customerEmail: 'client@example.com',
    });
    await store.enqueueJob({
      type: 'fulfillment',
      payload: { caseRef, packageId: 'probate_heirship' },
    });

    const result = await processOneFulfillmentJob({
      ownerEmail: 'owner@example.com',
    });

    assert.equal(result.ok, true);
    assert.equal(result.manualReview, true);

    const order = await store.getOrder(caseRef);
    assert.equal(order.status, 'manual_review');
    assert.ok(String(order.failure_reason || '').includes('Launch gate blocked automated paid-order flow'));
  } finally {
    restoreEnv(snapshot, LAUNCH_GATE_KEYS);
    await rm(dir, { recursive: true, force: true });
  }
});
