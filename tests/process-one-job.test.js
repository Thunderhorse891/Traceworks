import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('processOneFulfillmentJob preserves manual review status written by fulfillment', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tw-job-'));
  process.env.TRACEWORKS_STORE_PATH = join(dir, 'store.json');

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
    payload: { caseRef },
  });

  const result = await processOneFulfillmentJob({
    ownerEmail: 'owner@example.com',
    deps: {
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

  await rm(dir, { recursive: true, force: true });
});
