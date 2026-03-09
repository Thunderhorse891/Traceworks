import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  const metrics = await store.getMetrics();
  assert.equal(metrics.deadLetters >= 1, true);
  assert.equal(metrics.jobsByStatus.completed >= 1, true);

  await rm(dir, { recursive: true, force: true });
});
