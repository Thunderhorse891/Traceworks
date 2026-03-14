import { processOneFulfillmentJob } from './process-one-job.js';
import { getBusinessEmail } from './business.js';
import { getMetrics, recordAuditEvent } from './store.js';
import { sendOpsAlertEmail } from './email.js';

export async function runScheduledQueueWorker({
  ownerEmail = getBusinessEmail(),
  maxPerRun = Math.min(20, Math.max(1, Number(process.env.QUEUE_MAX_PER_RUN || 5))),
  queueLagAlertMs = Math.max(60_000, Number(process.env.QUEUE_LAG_ALERT_MS || 15 * 60_000))
} = {}) {
  const results = [];

  for (let i = 0; i < maxPerRun; i += 1) {
    const result = await processOneFulfillmentJob({ ownerEmail, maxAttempts: 5 });
    if (result.message === 'no_jobs') break;
    results.push(result);
  }

  const summary = {
    processed: results.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length
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

  return {
    ok: true,
    ...summary,
    queueDepth: metrics.queueDepth,
    queueOldestMs: metrics.queueOldestMs,
    lagging,
    message: results.length ? 'processed' : 'no_jobs'
  };
}
