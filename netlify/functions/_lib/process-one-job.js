import { claimJobByCaseRef, claimNextJob, completeJob, failJob, incrementFulfillmentAttempt, recordAuditEvent, recordDeadLetter, upsertOrder } from './store.js';
import { processFulfillmentJob } from './fulfillment.js';
import { ORDER_STATUS } from './order-status.js';
import { assessPaidOrderLaunchGate } from './launch-audit.js';

export async function processOneFulfillmentJob({ ownerEmail, maxAttempts = 5, caseRef: requestedCaseRef = null, deps = {} }) {
  const job = requestedCaseRef ? await claimJobByCaseRef('fulfillment', requestedCaseRef) : await claimNextJob('fulfillment');
  if (!job) return { ok: true, message: 'no_jobs' };

  const caseRef = job.payload?.caseRef || 'unknown';
  const evaluateLaunchGate = deps.assessPaidOrderLaunchGateImpl || assessPaidOrderLaunchGate;
  const launchGate = evaluateLaunchGate(process.env);
  if (!launchGate.ok) {
    await upsertOrder(caseRef, {
      status: ORDER_STATUS.MANUAL_REVIEW,
      lastError: null,
      retryAt: null,
      completed_at: new Date().toISOString(),
      failure_reason: launchGate.internalMessage
    });
    await recordAuditEvent({
      event: 'launch_gate_blocked_fulfillment_job',
      caseRef,
      jobId: job.id,
      blockingChecks: launchGate.blockingChecks.map((check) => check.id)
    });
    await completeJob(job.id);
    return { ok: true, message: 'launch_gate_blocked', jobId: job.id, caseRef, manualReview: true };
  }

  const attempt = await incrementFulfillmentAttempt(caseRef);
  await upsertOrder(caseRef, {
    status: ORDER_STATUS.RUNNING,
    lastAttemptAt: new Date().toISOString(),
    fulfillmentAttempts: attempt,
    lastError: null,
    retryAt: null
  });

  try {
    const runFulfillment = deps.processFulfillmentJobImpl || processFulfillmentJob;
    await runFulfillment(job, { ownerEmail });
    await upsertOrder(caseRef, {
      lastProcessedAt: new Date().toISOString(),
      lastError: null,
      retryAt: null
    });
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
