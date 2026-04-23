import { sendReportEmails } from './email.js';
import { saveReportArtifacts, assertArtifactExists, publicArtifactHint } from './artifacts.js';
import { getOrder, upsertOrder, recordAuditEvent } from './store.js';
import { ORDER_STATUS } from './order-status.js';
import { tierRunnerFor } from './tier-handlers.js';
import { buildDynamicReportFromWorkflow, dynamicReportToHtml, dynamicReportToText } from './dynamic-report-builder.js';
import { sanitizeCustomerFacingReport } from './customer-boundaries.js';

function now() {
  return new Date().toISOString();
}

function buildRepoCategoryPanel(workflow = {}) {
  const osint = workflow.osint;
  if (!osint || !Array.isArray(osint.repoCategoryResults) || !osint.repoCategoryResults.length) return null;

  const items = [];
  for (const category of osint.repoCategoryResults) {
    const repoList = Array.isArray(category.repoReferences) ? category.repoReferences.slice(0, 2).map((repo) => repo.slug || repo.url).filter(Boolean) : [];
    const queryPreview = Array.isArray(category.queryPlan) ? category.queryPlan.slice(0, 2).join(' | ') : '';
    items.push(`${category.label || category.categoryId}: ${Number(category.sources?.length || 0)} cited lead(s); repo references ${repoList.length ? repoList.join(', ') : 'not listed'}; queries ${queryPreview || 'not captured'}.`);
  }

  if (Array.isArray(osint.repoReferences) && osint.repoReferences.length) {
    items.push(`Overall repo references used in this run: ${osint.repoReferences.slice(0, 5).map((repo) => repo.slug || repo.url).filter(Boolean).join(', ')}.`);
  }

  return {
    title: 'Repo-Mapped OSINT Category Runs',
    items
  };
}

function appendRepoCategoryPanel(report = {}, workflow = {}) {
  const panel = buildRepoCategoryPanel(workflow);
  if (!panel) return report;
  const analysisPanels = Array.isArray(report.analysisPanels) ? report.analysisPanels : [];
  return {
    ...report,
    analysisPanels: [...analysisPanels, panel]
  };
}

export async function processPaidOrder(orderId, { ownerEmail, deps = {} } = {}) {
  const sendEmails = deps.sendReportEmails || sendReportEmails;
  const saveArtifacts = deps.saveReportArtifacts || saveReportArtifacts;
  const checkArtifact = deps.assertArtifactExists || assertArtifactExists;

  const order = await getOrder(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (![ORDER_STATUS.QUEUED, ORDER_STATUS.PAID, ORDER_STATUS.RUNNING].includes(order.status)) {
    throw new Error(`Order ${orderId} is not in a processable state (${order.status}).`);
  }

  const startedAt = now();
  await recordAuditEvent({ event: 'payment_verified_order_execution', orderId, purchasedTier: order.purchased_tier });
  await upsertOrder(orderId, { status: ORDER_STATUS.RUNNING, started_at: order.started_at || startedAt, workflow_selected: order.purchased_tier });

  try {
    const runner = deps.tierRunner || tierRunnerFor(order.purchased_tier);
    await recordAuditEvent({ event: 'tier_selected', orderId, tier: order.purchased_tier, handler: runner.name });

    const workflow = await runner(order, { startedAt, fetchImpl: deps.fetchImpl });
    await recordAuditEvent({ event: 'source_query_completed', orderId, sourcesAttempted: workflow.sources.length });

    const report = sanitizeCustomerFacingReport(
      appendRepoCategoryPanel(buildDynamicReportFromWorkflow(workflow, order), workflow)
    );
    const artifacts = await saveArtifacts(report);
    await checkArtifact(artifacts.htmlPath);
    await checkArtifact(artifacts.pdfPath);
    await recordAuditEvent({ event: 'report_rendered_and_saved', orderId, artifact: artifacts.htmlPath, pdfArtifact: artifacts.pdfPath });

    try {
      await sendEmails({
        ownerEmail,
        customerEmail: order.customerEmail,
        subject: `[${orderId}] Your ${order.purchased_tier} report is ready`,
        textBody: dynamicReportToText(report),
        htmlBody: dynamicReportToHtml(report)
      });
      await upsertOrder(orderId, { email_delivery_status: 'sent' });
      await recordAuditEvent({ event: 'email_sent', orderId, customerEmail: order.customerEmail });
    } catch (emailError) {
      const message = String(emailError?.message || emailError || 'email delivery failed');
      await upsertOrder(orderId, {
        status: ORDER_STATUS.DELIVERY_FAILED,
        artifact_url_or_path: publicArtifactHint(artifacts.htmlPath),
        completed_at: now(),
        email_delivery_status: 'failed',
        failure_reason: message
      });
      await recordAuditEvent({ event: 'email_failed', orderId, error: message });
      throw new Error(message);
    }

    const completedStatus = workflow.overallStatus === 'partial' ? ORDER_STATUS.MANUAL_REVIEW : ORDER_STATUS.COMPLETED;
    await upsertOrder(orderId, {
      status: completedStatus,
      artifact_url_or_path: publicArtifactHint(artifacts.htmlPath),
      completed_at: now(),
      failure_reason: workflow.overallStatus === 'failed' ? (workflow.failureReasons || []).join('; ') : null,
      sources_queried: workflow.sources,
      workflow_results: workflow
    });

    await recordAuditEvent({ event: 'order_completed', orderId, status: completedStatus, artifact: artifacts.htmlPath });
    return { report, artifacts, workflow };
  } catch (error) {
    const message = String(error?.message || error || 'unknown fulfillment error');
    await upsertOrder(orderId, {
      status: ORDER_STATUS.FAILED,
      completed_at: now(),
      failure_reason: message,
      email_delivery_status: order.email_delivery_status || 'pending'
    });
    await recordAuditEvent({ event: 'order_failed', orderId, error: message });
    throw error;
  }
}

export async function processFulfillmentJob(job, { ownerEmail }) {
  const payload = job.payload || {};
  const orderId = payload.caseRef;
  if (!orderId) throw new Error('Fulfillment job payload is missing caseRef/order_id.');
  return processPaidOrder(orderId, { ownerEmail });
}
