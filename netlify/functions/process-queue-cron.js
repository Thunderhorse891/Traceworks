import { runScheduledQueueWorker } from './_lib/process-queue-worker.js';

export default async () => {
  try {
    const result = await runScheduledQueueWorker();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: String(error?.message || error || 'unknown error')
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      }
    );
  }
};
