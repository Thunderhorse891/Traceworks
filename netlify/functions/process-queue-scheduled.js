import { jsonWithRequestId } from './_lib/http.js';
import { processOneFulfillmentJob } from './_lib/process-one-job.js';
import { getBusinessEmail } from './_lib/business.js';

export default async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return jsonWithRequestId(event, 405, { error: 'Method not allowed' });
  }

  const ownerEmail = getBusinessEmail();

  const maxPerRun = Math.min(20, Math.max(1, Number(process.env.QUEUE_MAX_PER_RUN || 5)));
  const results = [];

  for (let i = 0; i < maxPerRun; i++) {
    const result = await processOneFulfillmentJob({ ownerEmail, maxAttempts: 5 });
    if (result.message === 'no_jobs') break;
    results.push(result);
  }

  return jsonWithRequestId(event, 200, {
    ok: true,
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    message: results.length ? 'processed' : 'no_jobs'
  });
};
