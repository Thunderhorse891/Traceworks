import { jsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { processOneFulfillmentJob } from './_lib/process-one-job.js';
import { getBusinessEmail } from './_lib/business.js';

export default async (event) => {
  if (event.httpMethod !== 'POST') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  const key = process.env.ADMIN_API_KEY;
  const auth = event.headers.authorization || '';
  if (!key) return jsonWithRequestId(event, 500, { error: 'ADMIN_API_KEY is not configured.' });
  if (auth !== `Bearer ${key}`) return jsonWithRequestId(event, 401, { error: 'Unauthorized' });

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `queue-worker:${ip}`, windowMs: 60_000, max: 120 });
  if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests.' });

  const ownerEmail = getBusinessEmail();

  const result = await processOneFulfillmentJob({ ownerEmail, maxAttempts: 5 });
  if (result.message === 'no_jobs') return jsonWithRequestId(event, 200, { ok: true, message: 'no_jobs' });
  if (!result.ok) {
    const statusCode = result.terminal ? 500 : 202;
    return jsonWithRequestId(event, statusCode, {
      ok: false,
      error: result.error,
      jobId: result.jobId,
      caseRef: result.caseRef,
      terminal: result.terminal || false,
      retryAt: result.retryAt || null
    });
  }

  return jsonWithRequestId(event, 200, { ok: true, jobId: result.jobId, caseRef: result.caseRef });
};
