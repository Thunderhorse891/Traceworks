import { jsonWithRequestId } from './_lib/http.js';
import { runScheduledQueueWorker } from './_lib/process-queue-worker.js';

function authorized(event) {
  const secret = process.env.QUEUE_CRON_SECRET;
  if (!secret) return { ok: false, statusCode: 500, error: 'QUEUE_CRON_SECRET is not configured.' };
  const headers = event.headers || {};
  const header = headers['x-queue-cron-secret'] || headers['X-Queue-Cron-Secret'] || '';
  return header === secret
    ? { ok: true }
    : { ok: false, statusCode: 401, error: 'Unauthorized' };
}

export default async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return jsonWithRequestId(event, 405, { error: 'Method not allowed' });
  }

  const auth = authorized(event);
  if (!auth.ok) {
    return jsonWithRequestId(event, auth.statusCode, { error: auth.error });
  }

  const result = await runScheduledQueueWorker();
  return jsonWithRequestId(event, 200, result);
};
