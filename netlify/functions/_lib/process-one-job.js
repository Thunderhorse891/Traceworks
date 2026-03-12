import { claimJobByCaseRef, claimNextJob, completeJob, failJob, incrementFulfillmentAttempt, recordDeadLetter, upsertOrder } from './store.js';
import { processFulfillmentJob } from './fulfillment.js';
import { ORDER_STATUS } from './order-status.js';

export async function processOneFulfillmentJob({ ownerEmail, maxAttempts = 5, caseRef: requestedCaseRef = null }) {
  const job = requestedCaseRef ? await claimJobByCaseRef('fulfillment', requestedCaseRef) : await claimNextJob('fulfillment');
  if (!job) return { ok: true, message: 'no_jobs' };

  const caseRef = job.payload?.caseRef || 'unknown';
  const attempt = await incrementFulfillmentAttempt(caseRef);
  await upsertOrder(caseRef, {
    status: ORDER_STATUS.RUNNING,
    lastAttemptAt: new Date().toISOString(),
    fulfillmentAttempts: attempt,
    lastError: null,
    retryAt: null
  });

  try {
    const { report } = await processFulfillmentJob(job, { ownerEmail });
    await upsertOrder(caseRef, { status: ORDER_STATUS.COMPLETED, completedAt: new Date().toISOString(), lastError: null, retryAt: null });
    await completeJob(job.id);
    return { ok: true, jobId: job.id, caseRef };
  } catch (err) {
    const message = String(err?.message || err || 'unknown error');
    const failure = await failJob(job.id, message, maxAttempts);
    const terminal = !!failure?.terminal;
    const retryAt = failure?.nextAttemptAt || null;

    await upsertOrder(caseRef, {
      status: terminal ? ORDER_STATUS.FAILED : ORDER_STATUS.QUEUED,
      lastError: message,
      retryAt
    });

    if (terminal) {
      await recordDeadLetter({ caseRef, jobId: job.id, error: message, source: 'process-queue' });
    }

    return { ok: false, jobId: job.id, caseRef, error: message, terminal, retryAt };
  }
}
