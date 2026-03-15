import { requireAdmin } from './_lib/admin-auth.js';
import { getBusinessEmail } from './_lib/business.js';
import { jsonWithRequestId } from './_lib/http.js';
import { assessOrderLaunchGate } from './_lib/launch-audit.js';
import { ORDER_STATUS } from './_lib/order-status.js';
import { processOneFulfillmentJob } from './_lib/process-one-job.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { getOrder, recordAuditEvent, requeueCaseJob, upsertOrder } from './_lib/store.js';
import { resolveInvestigationInput } from './_lib/validation.js';

function clean(value) {
  return String(value || '').trim();
}

function buildJobPayload(order, input) {
  return {
    caseRef: order.caseRef || order.order_id,
    packageId: order.packageId || input.packageId || '',
    subjectType: input.subjectType || order.subjectType || 'person',
    subjectName: input.subjectName || order.subjectName || '',
    county: input.county || order.county || '',
    state: input.state || order.state || 'TX',
    lastKnownAddress: input.lastKnownAddress || order.lastKnownAddress || '',
    parcelId: input.parcelId || order.parcelId || ''
  };
}

export default async (event) => {
  return handleAdminAction(event);
};

export async function handleAdminAction(event, deps = {}) {
  if (event.httpMethod !== 'POST') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  const auth = requireAdmin(event);
  if (!auth.ok) return auth.response;

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `admin-actions:${ip}`, windowMs: 60_000, max: 60 });
  if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests.' });

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonWithRequestId(event, 400, { error: 'Invalid JSON payload.' });
  }

  const action = clean(body.action).toLowerCase();

  if (action === 'run_queue_once') {
    const requestedCaseRef = clean(body.caseRef) || null;
    const runOneJob = deps.processOneFulfillmentJobImpl || processOneFulfillmentJob;
    const result = await runOneJob({
      ownerEmail: getBusinessEmail(),
      maxAttempts: 5,
      caseRef: requestedCaseRef
    });

    if (result.message === 'no_jobs') {
      return jsonWithRequestId(event, 200, { ok: true, action, message: 'no_jobs', caseRef: requestedCaseRef });
    }

    if (!result.ok) {
      return jsonWithRequestId(event, result.terminal ? 500 : 202, {
        ok: false,
        action,
        error: result.error,
        jobId: result.jobId,
        caseRef: result.caseRef,
        terminal: Boolean(result.terminal),
        retryAt: result.retryAt || null
      });
    }

    return jsonWithRequestId(event, 200, {
      ok: true,
      action,
      message: result.message || 'processed',
      jobId: result.jobId,
      caseRef: result.caseRef,
      manualReview: Boolean(result.manualReview)
    });
  }

  if (action === 'requeue_case') {
    const caseRef = clean(body.caseRef);
    if (!caseRef) return jsonWithRequestId(event, 400, { error: 'caseRef is required.' });

    const loadOrder = deps.getOrderImpl || getOrder;
    const order = await loadOrder(caseRef);
    if (!order) return jsonWithRequestId(event, 404, { error: 'Order not found.' });

    const packageId = order.packageId || order.input_criteria?.packageId || '';
    if (!packageId) {
      return jsonWithRequestId(event, 409, {
        error: 'The order is missing its package ID and cannot be safely requeued.'
      });
    }

    const input = resolveInvestigationInput(order);
    const evaluateOrderGate = deps.assessOrderLaunchGateImpl || assessOrderLaunchGate;
    const gate = evaluateOrderGate(packageId, input, process.env);
    if (!gate.launchReady) {
      return jsonWithRequestId(event, 409, {
        error: gate.launchMessage,
        launchBlocked: true,
        blockingAreas: gate.launchBlockingAreas,
        blockingDetails: gate.launchBlockingDetails
      });
    }

    const queueCaseJob = deps.requeueCaseJobImpl || requeueCaseJob;
    const queued = await queueCaseJob('fulfillment', caseRef, buildJobPayload(order, input));
    if (!queued.ok) {
      const activeJob = queued.job || null;
      return jsonWithRequestId(event, 409, {
        error: 'An active fulfillment job already exists for this case.',
        reason: queued.reason,
        caseRef,
        jobId: activeJob?.id || null,
        jobStatus: activeJob?.status || null
      });
    }

    const saveOrder = deps.upsertOrderImpl || upsertOrder;
    await saveOrder(caseRef, {
      status: ORDER_STATUS.QUEUED,
      retryAt: null,
      lastError: null,
      completed_at: null,
      failure_reason: null,
      manualReviewLikely: Boolean(gate.manualReviewLikely),
      manualReviewIndicators: gate.manualReviewDetails || [],
      coverage_assessment: gate.orderCoverage || order.coverage_assessment || null
    });

    const logAuditEvent = deps.recordAuditEventImpl || recordAuditEvent;
    await logAuditEvent({
      event: 'admin_requeued_case',
      caseRef,
      packageId,
      previousStatus: order.status || null,
      previousJobId: queued.previousJob?.id || null,
      jobId: queued.job.id
    });

    return jsonWithRequestId(event, 200, {
      ok: true,
      action,
      caseRef,
      packageId,
      jobId: queued.job.id,
      status: ORDER_STATUS.QUEUED,
      manualReviewLikely: Boolean(gate.manualReviewLikely),
      manualReviewDetails: gate.manualReviewDetails || []
    });
  }

  return jsonWithRequestId(event, 400, { error: 'Unsupported admin action.' });
}
