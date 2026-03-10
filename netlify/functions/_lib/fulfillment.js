import { buildReport } from './report.js';
import { sendReportEmails } from './email.js';
import { saveReportArtifacts, assertArtifactExists, publicArtifactHint } from './artifacts.js';
import { getOrder, upsertOrder, recordAuditEvent } from './store.js';
import { ORDER_STATUS } from './order-status.js';
import { REPORT_TIER } from './tier-mapping.js';
import { runComprehensiveReport, runHeirLocationReport, runStandardReport, runTitlePropertyReport } from './tier-handlers.js';

function now() {
  return new Date().toISOString();
}

function handlerForTier(tier) {
  if (tier === REPORT_TIER.STANDARD_REPORT) return runStandardReport;
  if (tier === REPORT_TIER.TITLE_PROPERTY_REPORT) return runTitlePropertyReport;
  if (tier === REPORT_TIER.HEIR_LOCATION_REPORT) return runHeirLocationReport;
  if (tier === REPORT_TIER.COMPREHENSIVE_REPORT) return runComprehensiveReport;
  throw new Error(`No workflow handler configured for purchased tier: ${tier}`);
}

export async function processPaidOrder(orderId, { ownerEmail, deps = {} } = {}) {
  const sendEmails = deps.sendReportEmails || sendReportEmails;
  const saveArtifacts = deps.saveReportArtifacts || saveReportArtifacts;
  const checkArtifact = deps.assertArtifactExists || assertArtifactExists;

  const order = await getOrder(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.status !== ORDER_STATUS.QUEUED && order.status !== ORDER_STATUS.PAID && order.status !== ORDER_STATUS.RUNNING) {
    throw new Error(`Order ${orderId} is not in a processable state (${order.status}).`);
  }

  await recordAuditEvent({ event: 'fulfillment_started', orderId, purchasedTier: order.purchased_tier, statusBefore: order.status });
  await upsertOrder(orderId, { status: ORDER_STATUS.RUNNING, started_at: order.started_at || now(), startedAt: order.startedAt || now() });

  try {
    const runner = deps.tierRunner || handlerForTier(order.purchased_tier);
    await recordAuditEvent({ event: 'tier_handler_selected', orderId, purchasedTier: order.purchased_tier, handler: runner.name });

    const intel = await runner(order);
    await recordAuditEvent({ event: 'source_query_completed', orderId, purchasedTier: order.purchased_tier, providersWithHits: intel?.coverage?.providersWithHits || 0 });

    const report = buildReport({
      caseRef: order.order_id || order.caseRef || orderId,
      packageId: order.packageId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      companyName: order.subjectName,
      website: order.website,
      goals: order.goals,
      intel
    });

    const artifacts = await saveArtifacts(report);
    await checkArtifact(artifacts.htmlPath);
    await recordAuditEvent({ event: 'report_artifact_saved', orderId, artifact: artifacts.htmlPath });

    try {
      await sendEmails({
        ownerEmail,
        customerEmail: report.customerEmail,
        subject: `[${report.caseRef}] Your ${report.package} report is ready`,
        textBody: `Your report is ready. Artifact: ${artifacts.htmlPath}\n\n${report.disclaimer}`,
        htmlBody: `<p>Your report is ready.</p><p><strong>Artifact:</strong> ${artifacts.htmlPath}</p>`
      });
      await recordAuditEvent({ event: 'report_email_sent', orderId, customerEmail: report.customerEmail });
    } catch (emailError) {
      const message = String(emailError?.message || emailError || 'email delivery failed');
      await upsertOrder(orderId, {
        status: ORDER_STATUS.DELIVERY_FAILED,
        artifact_url_or_path: publicArtifactHint(artifacts.htmlPath),
        completed_at: now(),
        email_delivery_status: 'failed',
        failure_reason: message,
        failureReason: message
      });
      await recordAuditEvent({ event: 'report_email_failed', orderId, error: message });
      throw new Error(message);
    }

    await upsertOrder(orderId, {
      status: ORDER_STATUS.COMPLETED,
      artifact_url_or_path: publicArtifactHint(artifacts.htmlPath),
      completed_at: now(),
      email_delivery_status: 'sent',
      failure_reason: null,
      failureReason: null,
      workflow_selected: order.purchased_tier,
      sources_queried: intel?.providerHealth || []
    });

    await recordAuditEvent({ event: 'fulfillment_completed', orderId, artifact: artifacts.htmlPath, purchasedTier: order.purchased_tier });
    return { report, artifacts };
  } catch (error) {
    const message = String(error?.message || error || 'unknown fulfillment error');
    await upsertOrder(orderId, {
      status: ORDER_STATUS.FAILED,
      completed_at: now(),
      email_delivery_status: order.email_delivery_status || 'pending',
      failure_reason: message,
      failureReason: message
    });
    await recordAuditEvent({ event: 'fulfillment_failed', orderId, error: message });
    throw error;
  }
}

export async function processFulfillmentJob(job, { ownerEmail }) {
  const payload = job.payload || {};
  const orderId = payload.caseRef;
  if (!orderId) throw new Error('Fulfillment job payload is missing caseRef/order_id.');
  return processPaidOrder(orderId, { ownerEmail });
}
