import { sendJsonWithRequestId } from './_lib/http.js';
import { processOneFulfillmentJob } from './_lib/process-one-job.js';
import { getBusinessEmail } from './_lib/business.js';
import { getMetrics, recordAuditEvent } from './_lib/store.js';
import { sendOpsAlertEmail } from './_lib/email.js';

function authorized(req) {
  const secret = process.env.QUEUE_CRON_SECRET;
  if (!secret) return true;
  const header = req.headers['x-queue-cron-secret'] || '';
  return header === secret;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJsonWithRequestId(req, res, 405, { error: 'Method not allowed' });
  }

  if (!authorized(req)) {
    return sendJsonWithRequestId(req, res, 401, { error: 'Unauthorized' });
  }

  const ownerEmail = getBusinessEmail();
  const maxPerRun = Math.min(20, Math.max(1, Number(process.env.QUEUE_MAX_PER_RUN || 5)));
  const queueLagAlertMs = Math.max(60_000, Number(process.env.QUEUE_LAG_ALERT_MS || 15 * 60_000));

  const results = [];
  for (let i = 0; i < maxPerRun; i++) {
    const result = await processOneFulfillmentJob({ ownerEmail, maxAttempts: 5 });
    if (result.message === 'no_jobs') break;
    results.push(result);
  }

  const summary = {
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length
  };

  const metrics = await getMetrics();
  const lagging = metrics.queueOldestMs >= queueLagAlertMs;
  const hasFailures = summary.failed > 0;

  await recordAuditEvent({
    event: 'scheduled_worker_run',
    summary,
    queueDepth: metrics.queueDepth,
    queueOldestMs: metrics.queueOldestMs,
    lagging,
    hasFailures
  });

  if (lagging || hasFailures) {
    await sendOpsAlertEmail({
      ownerEmail,
      subject: lagging ? 'Queue lag threshold exceeded' : 'Scheduled worker failures detected',
      lines: [
        `Processed: ${summary.processed}`,
        `Succeeded: ${summary.succeeded}`,
        `Failed: ${summary.failed}`,
        `Queue depth: ${metrics.queueDepth}`,
        `Queue oldest ms: ${metrics.queueOldestMs}`,
        `Threshold ms: ${queueLagAlertMs}`
      ]
    });
  }

  return sendJsonWithRequestId(req, res, 200, {
    ok: true,
    ...summary,
    queueDepth: metrics.queueDepth,
    queueOldestMs: metrics.queueOldestMs,
    lagging,
    message: results.length ? 'processed' : 'no_jobs'
  });
}
