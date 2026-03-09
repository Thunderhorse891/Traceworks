import { buildReport, reportToHtml, reportToText } from './report.js';
import { sendReportEmails } from './email.js';
import { gatherOsint } from './osint.js';

export async function processFulfillmentJob(job, { ownerEmail }) {
  const payload = job.payload || {};
  const osint = await gatherOsint(`${payload.companyName || ''} ${payload.website || ''} ${payload.goals || ''}`, { packageId: payload.packageId });

  const report = buildReport({
    caseRef: payload.caseRef,
    packageId: payload.packageId,
    customerName: payload.customerName,
    customerEmail: payload.customerEmail,
    companyName: payload.companyName,
    website: payload.website,
    goals: payload.goals,
    intel: osint
  });

  await sendReportEmails({
    ownerEmail,
    customerEmail: report.customerEmail,
    subject: `[${report.caseRef}] Your ${report.package} report is ready`,
    textBody: reportToText(report),
    htmlBody: reportToHtml(report)
  });

  return { report };
}
