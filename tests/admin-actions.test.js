import test from 'node:test';
import assert from 'node:assert/strict';

function withAdminKey() {
  const prior = process.env.ADMIN_API_KEY;
  process.env.ADMIN_API_KEY = 'admin-secret';
  return () => {
    if (prior === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = prior;
  };
}

function makeEvent(body, overrides = {}) {
  return {
    httpMethod: 'POST',
    headers: {
      authorization: 'Bearer admin-secret',
      ...overrides.headers
    },
    body: JSON.stringify(body),
    ...overrides
  };
}

test('admin requeue_case queues a manual-review order with an audit event', async () => {
  const auditEntries = [];
  const savedOrders = [];
  const { handleAdminAction } = await import(`../netlify/functions/admin-actions.js?ts=${Date.now()}`);
  const restore = withAdminKey();

  try {
    const response = await handleAdminAction(makeEvent({
      action: 'requeue_case',
      caseRef: 'TW-READY'
    }), {
      getOrderImpl: async () => ({
        caseRef: 'TW-READY',
        packageId: 'standard',
        status: 'manual_review',
        subjectName: 'Jane Owner',
        county: 'Harris',
        state: 'TX',
        input_criteria: {
          subjectName: 'Jane Owner',
          subjectType: 'property',
          county: 'Harris',
          state: 'TX'
        }
      }),
      assessOrderLaunchGateImpl: () => ({
        launchReady: true,
        manualReviewLikely: false,
        manualReviewDetails: [],
        orderCoverage: { locationLabel: 'Harris County, TX' }
      }),
      requeueCaseJobImpl: async () => ({
        ok: true,
        job: { id: 'job_ready_1', status: 'queued' },
        previousJob: { id: 'job_old_1', status: 'failed' }
      }),
      upsertOrderImpl: async (caseRef, patch) => {
        savedOrders.push({ caseRef, patch });
        return { caseRef, ...patch };
      },
      recordAuditEventImpl: async (entry) => {
        auditEntries.push(entry);
      }
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.ok, true);
    assert.equal(body.caseRef, 'TW-READY');
    assert.equal(body.jobId, 'job_ready_1');
    assert.equal(savedOrders.length, 1);
    assert.equal(savedOrders[0].patch.status, 'queued');
    assert.equal(auditEntries[0].event, 'admin_requeued_case');
  } finally {
    restore();
  }
});

test('admin requeue_case refuses to enqueue a blocked jurisdiction', async () => {
  const { handleAdminAction } = await import(`../netlify/functions/admin-actions.js?ts=${Date.now()}`);
  const restore = withAdminKey();

  try {
    const response = await handleAdminAction(makeEvent({
      action: 'requeue_case',
      caseRef: 'TW-BLOCKED'
    }), {
      getOrderImpl: async () => ({
        caseRef: 'TW-BLOCKED',
        packageId: 'standard',
        status: 'manual_review',
        subjectName: 'Jane Owner',
        county: 'Dallas',
        state: 'TX',
        input_criteria: {
          subjectName: 'Jane Owner',
          subjectType: 'property',
          county: 'Dallas',
          state: 'TX'
        }
      }),
      assessOrderLaunchGateImpl: () => ({
        launchReady: false,
        launchMessage: 'Coverage is not ready for Dallas County, TX.',
        launchBlockingAreas: ['jurisdiction'],
        launchBlockingDetails: [{ id: 'countyProperty_coverage', label: 'County property coverage', detail: 'Not configured.' }]
      }),
      requeueCaseJobImpl: async () => {
        throw new Error('requeueCaseJob should not run when launch gate is blocked');
      }
    });

    assert.equal(response.statusCode, 409);
    const body = JSON.parse(response.body);
    assert.equal(body.launchBlocked, true);
    assert.equal(body.blockingAreas[0], 'jurisdiction');
  } finally {
    restore();
  }
});

test('admin run_queue_once surfaces the worker result', async () => {
  const { handleAdminAction } = await import(`../netlify/functions/admin-actions.js?ts=${Date.now()}`);
  const restore = withAdminKey();

  try {
    const response = await handleAdminAction(makeEvent({
      action: 'run_queue_once',
      caseRef: 'TW-RUN'
    }), {
      processOneFulfillmentJobImpl: async ({ caseRef }) => ({
        ok: true,
        message: 'processed',
        caseRef,
        jobId: 'job_run_1',
        manualReview: false
      })
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.ok, true);
    assert.equal(body.caseRef, 'TW-RUN');
    assert.equal(body.jobId, 'job_run_1');
  } finally {
    restore();
  }
});
