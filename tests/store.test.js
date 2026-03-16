import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function makeBlobModule() {
  const entries = new Map();
  let version = 0;

  function nextEtag() {
    version += 1;
    return `etag-${version}`;
  }

  function makeStore() {
    return {
      async get(key, options = {}) {
        const entry = entries.get(key);
        if (!entry) return null;
        return options.type === 'json' ? JSON.parse(entry.value) : entry.value;
      },
      async getWithMetadata(key, options = {}) {
        const entry = entries.get(key);
        if (!entry) return null;
        return {
          data: options.type === 'json' ? JSON.parse(entry.value) : entry.value,
          etag: entry.etag,
          metadata: {}
        };
      },
      async set(key, value) {
        const etag = nextEtag();
        entries.set(String(key), { value: String(value), etag });
        return { etag, modified: true };
      },
      async setJSON(key, value, options = {}) {
        const current = entries.get(String(key));
        if (options.onlyIfNew && current) {
          return { etag: current.etag, modified: false };
        }
        if (options.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) {
          return { etag: current?.etag, modified: false };
        }
        const etag = nextEtag();
        entries.set(String(key), { value: JSON.stringify(value), etag });
        return { etag, modified: true };
      },
      async delete(key) {
        entries.delete(String(key));
      }
    };
  }

  return {
    getStore() {
      return makeStore();
    }
  };
}

test('store persists order/events/deadletters and queue jobs with backoff', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tw-store-'));
  process.env.TRACEWORKS_STORE_PATH = join(dir, 'store.json');

  const store = await import(`../netlify/functions/_lib/store.js?ts=${Date.now()}`);
  await store.upsertOrder('TW-X', { status: 'processing', customerEmail: 'a@b.com' });
  const order = await store.getOrder('TW-X');
  assert.equal(order.status, 'processing');

  const attempt = await store.incrementFulfillmentAttempt('TW-X');
  assert.equal(attempt >= 1, true);

  assert.equal(await store.isProcessedWebhookEvent('evt_1'), false);
  await store.markProcessedWebhookEvent('evt_1');
  assert.equal(await store.isProcessedWebhookEvent('evt_1'), true);

  const queued = await store.enqueueJob({ type: 'fulfillment', payload: { caseRef: 'TW-X' } });
  assert.equal(queued.status, 'queued');

  const claimed = await store.claimNextJob('fulfillment');
  assert.equal(claimed.id, queued.id);
  assert.equal(claimed.status, 'processing');

  const failure = await store.failJob(claimed.id, 'temporary', 3);
  assert.equal(failure.terminal, false);
  assert.equal(typeof failure.nextAttemptAt, 'string');

  const immediateRetry = await store.claimNextJob('fulfillment');
  assert.equal(immediateRetry, null);

  await new Promise((r) => setTimeout(r, 1100));
  const retryJob = await store.claimNextJob('fulfillment');
  assert.equal(retryJob.id, queued.id);
  assert.equal(retryJob.attempts >= 2, true);

  await store.completeJob(queued.id);

  await store.recordDeadLetter({ caseRef: 'TW-X', error: 'boom' });
  await store.recordAuditEvent({ event: 'test_audit', ok: true });
  const metrics = await store.getMetrics();
  assert.equal(metrics.deadLetters >= 1, true);
  assert.equal(metrics.jobsByStatus.completed >= 1, true);
  assert.equal(metrics.auditLogEvents >= 1, true);
  assert.equal(metrics.queueOldestMs >= 0, true);

  const snapshot = await store.getOperationsSnapshot(5);
  assert.equal(snapshot.recentDeadLetters.length >= 1, true);
  assert.equal(snapshot.recentAuditEvents.length >= 1, true);

  await rm(dir, { recursive: true, force: true });
});

test('store can claim a due job by caseRef without claiming unrelated jobs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tw-store-'));
  process.env.TRACEWORKS_STORE_PATH = join(dir, 'store.json');

  const store = await import(`../netlify/functions/_lib/store.js?ts=${Date.now()}`);

  const jobA = await store.enqueueJob({ type: 'fulfillment', payload: { caseRef: 'TW-A' } });
  const jobB = await store.enqueueJob({ type: 'fulfillment', payload: { caseRef: 'TW-B' } });

  const claimedB = await store.claimJobByCaseRef('fulfillment', 'TW-B');
  assert.equal(claimedB.id, jobB.id);

  const next = await store.claimNextJob('fulfillment');
  assert.equal(next.id, jobA.id);

  await rm(dir, { recursive: true, force: true });
});

test('operations snapshot exposes manual review orders and active jobs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tw-store-ops-'));
  process.env.TRACEWORKS_STORE_PATH = join(dir, 'store.json');

  const store = await import(`../netlify/functions/_lib/store.js?ts=${Date.now()}`);
  await store.upsertOrder('TW-MANUAL', { status: 'manual_review', failure_reason: 'County coverage pending.' });
  await store.enqueueJob({ type: 'fulfillment', payload: { caseRef: 'TW-QUEUE' } });
  await store.recordAuditEvent({ event: 'order_coverage_blocked_fulfillment_job', caseRef: 'TW-MANUAL' });
  await store.recordLaunchProof({ packageId: 'standard', subjectName: 'Jane Owner', ok: true });

  const snapshot = await store.getOperationsSnapshot(10);
  assert.equal(snapshot.manualReviewOrders.length, 1);
  assert.equal(snapshot.activeJobs.length, 1);
  assert.equal(snapshot.recentAuditEvents[0].event, 'order_coverage_blocked_fulfillment_job');
  assert.equal(snapshot.recentLaunchProofs.length, 1);
  assert.equal(snapshot.recentLaunchProofs[0].packageId, 'standard');

  await rm(dir, { recursive: true, force: true });
});

test('requeueCaseJob creates one new queued job and blocks duplicate active retries', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tw-store-requeue-'));
  process.env.TRACEWORKS_STORE_PATH = join(dir, 'store.json');

  const store = await import(`../netlify/functions/_lib/store.js?ts=${Date.now()}`);
  await store.enqueueJob({ type: 'fulfillment', payload: { caseRef: 'TW-RETRY', packageId: 'standard' } });
  const first = await store.requeueCaseJob('fulfillment', 'TW-RETRY', { subjectName: 'Jane Doe' });

  assert.equal(first.ok, false);
  assert.equal(first.reason, 'active_job_exists');

  const claimed = await store.claimJobByCaseRef('fulfillment', 'TW-RETRY');
  await store.failJob(claimed.id, 'terminal error', 1);

  const second = await store.requeueCaseJob('fulfillment', 'TW-RETRY', { subjectName: 'Jane Doe' });
  assert.equal(second.ok, true);
  assert.equal(second.job.status, 'queued');
  assert.equal(second.job.payload.caseRef, 'TW-RETRY');
  assert.equal(second.previousJob.id, claimed.id);

  await rm(dir, { recursive: true, force: true });
});

test('store defaults to the runtime temp directory on Netlify file storage', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tw-store-netlify-'));
  const previous = {
    NETLIFY: process.env.NETLIFY,
    DEPLOY_ID: process.env.DEPLOY_ID,
    AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
    TMPDIR: process.env.TMPDIR,
    TRACEWORKS_STORE_PATH: process.env.TRACEWORKS_STORE_PATH
  };

  delete process.env.NETLIFY;
  delete process.env.DEPLOY_ID;
  process.env.AWS_LAMBDA_FUNCTION_NAME = 'traceworks-source-proof';
  process.env.TMPDIR = dir;
  delete process.env.TRACEWORKS_STORE_PATH;

  try {
    const store = await import(`../netlify/functions/_lib/store.js?ts=${Date.now()}`);
    await store.upsertOrder('TW-TMP', { status: 'manual_review' });
    const order = await store.getOrder('TW-TMP');
    assert.equal(order.status, 'manual_review');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test('store persists through the blobs storage driver', async () => {
  const previousDriver = process.env.TRACEWORKS_STORAGE_DRIVER;
  const previousModule = globalThis.__traceworksBlobsModule;
  process.env.TRACEWORKS_STORAGE_DRIVER = 'blobs';
  globalThis.__traceworksBlobsModule = makeBlobModule();

  try {
    const store = await import(`../netlify/functions/_lib/store.js?ts=${Date.now()}`);
    await store.upsertOrder('TW-BLOB', { status: 'queued', customerEmail: 'blob@example.com' });
    await store.recordLaunchProof({ packageId: 'standard', subjectName: 'Blob Proof', ok: true });

    const order = await store.getOrder('TW-BLOB');
    const proofs = await store.listLaunchProofs(5);

    assert.equal(order.status, 'queued');
    assert.equal(proofs.length, 1);
    assert.equal(proofs[0].subjectName, 'Blob Proof');
  } finally {
    if (previousDriver === undefined) delete process.env.TRACEWORKS_STORAGE_DRIVER;
    else process.env.TRACEWORKS_STORAGE_DRIVER = previousDriver;

    if (previousModule === undefined) delete globalThis.__traceworksBlobsModule;
    else globalThis.__traceworksBlobsModule = previousModule;
  }
});
