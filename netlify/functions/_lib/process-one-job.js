import { claimJobByCaseRef, claimNextJob, completeJob, failJob, getOrder, incrementFulfillmentAttempt, recordAuditEvent, recordDeadLetter, upsertOrder } from './store.js';
import { processFulfillmentJob } from './fulfillment.js';
import { ORDER_STATUS } from './order-status.js';
import { assessOrderLaunchGate, assessPackageLaunchGate } from './launch-audit.js';
import { resolveInvestigationInput } from './validation.js';

export async function processOneFulfillmentJob({ ownerEmail, maxAttempts = 5, caseRef: requestedCaseRef = null, deps = {} }) {
  const job = requestedCaseRef ? await claimJobByCaseRef('fulfillment', requestedCaseRef) : await claimNextJob('fulfillment');
  if (!job) return { ok: true, message: 'no_jobs' };

  const caseRef = job.payload?.caseRef || 'unknown';
  const packageId = job.payload?.packageId || '';
  const evaluateLaunchGate = deps.assessPackageLaunchGateImpl || assessPackageLaunchGate;
  const launchGate = evaluateLaunchGate(packageId, process.env);
  const existingOrder = (deps.getOrderImpl || getOrder) ? await (deps.getOrderImpl || getOrder)(caseRef) : null;
  if (!launchGate.launchReady) {
    await upsertOrder(caseRef, {
      status: ORDER_STATUS.MANUAL_REVIEW,
      lastError: null,
      retryAt: null,
      completed_at: new Date().toISOString(),
      failure_reason: `Launch gate blocked automated paid-order flow for ${packageId || 'unknown package'}: ${launchGate.launchBlockingDetails.map((detail) => `${detail.label} (${detail.id})`).join(', ')}.`
    });
    await recordAuditEvent({
      event: 'launch_gate_blocked_fulfillment_job',
      caseRef,
      jobId: job.id,
      packageId,
      blockingChecks: launchGate.launchBlockingDetails.map((detail) => detail.id)
    });
    await completeJob(job.id);
    return { ok: true, message: 'launch_gate_blocked', jobId: job.id, caseRef, manualReview: true };
  }

  const evaluateOrderGate = deps.assessOrderLaunchGateImpl || assessOrderLaunchGate;
  const orderInput = existingOrder
    ? resolveInvestigationInput(existingOrder)
    : {
        packageId,
        subjectType: job.payload?.subjectType || 'person',
        subjectName: job.payload?.subjectName || '',
        county: job.payload?.county || '',
        state: job.payload?.state || 'TX',
        lastKnownAddress: job.payload?.lastKnownAddress || '',
        parcelId: job.payload?.parcelId || ''
      };
  const canAssessOrderCoverage = Boolean(String(orderInput.county || '').trim());

  if (canAssessOrderCoverage) {
    const orderGate = evaluateOrderGate(packageId, orderInput, process.env);
    if (!orderGate.launchReady) {
      const blockingDetails = orderGate.launchBlockingDetails.map((detail) => `${detail.label} (${detail.id})`).join(', ');
      await upsertOrder(caseRef, {
        status: ORDER_STATUS.MANUAL_REVIEW,
        lastError: null,
        retryAt: null,
        completed_at: new Date().toISOString(),
        failure_reason: `Automated source coverage is not ready for ${orderGate.orderCoverage?.locationLabel || 'the requested jurisdiction'} on ${packageId || 'unknown package'}: ${blockingDetails}.`
      });
      await recordAuditEvent({
        event: 'order_coverage_blocked_fulfillment_job',
        caseRef,
        jobId: job.id,
        packageId,
        location: orderGate.orderCoverage?.locationLabel || '',
        blockingChecks: orderGate.launchBlockingDetails.map((detail) => detail.id)
      });
      await completeJob(job.id);
      return { ok: true, message: 'order_coverage_blocked', jobId: job.id, caseRef, manualReview: true };
    }
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
