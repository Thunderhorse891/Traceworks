import { runWorkflow } from './workflow.js';
import { reportToHtml, reportToText } from './report.js';
import { sendReportEmails } from './email.js';
import { upsertOrder } from './store.js';

export async function processFulfillmentJob(job, { ownerEmail }) {
  const payload = job.payload || {};
  const tier    = payload.packageId;

  const workflowResults = await runWorkflow(tier, {
    caseRef:     payload.caseRef,
    companyName: payload.companyName || payload.subjectName || '',
    county:      payload.county || 'Harris',
    state:       payload.state  || 'TX',
    customerName:  payload.customerName,
    customerEmail: payload.customerEmail,
    goals:   payload.goals   || '',
    website: payload.website || '',
  });

  const htmlBody = reportToHtml(workflowResults);
  const textBody = reportToText(workflowResults);

  await sendReportEmails({
    ownerEmail,
    customerEmail: payload.customerEmail,
    subject: `[${payload.caseRef}] Your TraceWorks Report is Ready`,
    textBody,
    htmlBody,
  });

  // Persist workflowResults on the order for admin dashboard
  await upsertOrder(payload.caseRef, {
    workflowResults: {
      overallStatus:   workflowResults.overallStatus,
      sourceSummary:   workflowResults.sourceSummary,
      entityDetected:  workflowResults.inputs?.entityDetected ?? false,
      entityType:      workflowResults.inputs?.entityType ?? null,
      partialReasons:  workflowResults.partialReasons,
      failureReasons:  workflowResults.failureReasons,
    },
  });

  return { workflowResults };
}
