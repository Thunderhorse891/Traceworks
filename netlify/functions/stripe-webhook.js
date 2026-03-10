import Stripe from 'stripe';
import { enqueueJob, isProcessedWebhookEvent, markProcessedWebhookEvent, upsertOrder } from './_lib/store.js';
import { jsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { processOneFulfillmentJob } from './_lib/process-one-job.js';
import { getBusinessEmail } from './_lib/business.js';

const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

export default async (event) => {
  if (event.httpMethod !== 'POST') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  const body = event.body || '';
  if (Buffer.byteLength(body, 'utf8') > MAX_WEBHOOK_BODY_BYTES) {
    return jsonWithRequestId(event, 413, { error: 'Webhook payload too large.' });
  }

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `webhook:${ip}`, windowMs: 60_000, max: 120 });
  if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests.' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) return jsonWithRequestId(event, 500, { error: 'Missing required environment variables.' });

  const sig = event.headers['stripe-signature'];
  if (!sig) return jsonWithRequestId(event, 400, { error: 'Missing stripe-signature header.' });

  const stripe = new Stripe(stripeKey);
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(body, sig, webhookSecret, 300);
  } catch (err) {
    return jsonWithRequestId(event, 400, { error: `Webhook Error: ${err.message}` });
  }

  if (await isProcessedWebhookEvent(stripeEvent.id)) return jsonWithRequestId(event, 200, { ok: true, duplicate: true });

  if (stripeEvent.type !== 'checkout.session.completed') {
    await markProcessedWebhookEvent(stripeEvent.id);
    return jsonWithRequestId(event, 200, { ok: true, ignored: true });
  }

  const session = stripeEvent.data.object;
  const metadata = session.metadata || {};
  const caseRef = metadata.caseRef || `TW-${session.id}`;

  await upsertOrder(caseRef, {
    status: 'queued',
    stripeSessionId: session.id,
    packageId: metadata.packageId,
    packageName: metadata.packageName,
    customerName: metadata.customerName,
    customerEmail: metadata.customerEmail || session.customer_details?.email,
    subjectName: metadata.companyName,
    website: metadata.website,
    goals: metadata.goals,
    queuedAt: new Date().toISOString()
  });

  await enqueueJob({
    type: 'fulfillment',
    payload: {
      caseRef,
      packageId: metadata.packageId,
      customerName: metadata.customerName,
      customerEmail: metadata.customerEmail || session.customer_details?.email,
      companyName: metadata.companyName,
      website: metadata.website,
      goals: metadata.goals
    }
  });

  // Best-effort immediate fulfillment kick-off for this exact case so paid orders begin processing right away.
  const immediateMs = Math.max(500, Number(process.env.IMMEDIATE_FULFILLMENT_TIMEOUT_MS || 3500));
  try {
    await Promise.race([
      processOneFulfillmentJob({ ownerEmail: getBusinessEmail(), maxAttempts: 5, caseRef }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('immediate processing timeout')), immediateMs))
    ]);
  } catch {
    // Scheduled queue worker will continue retries if immediate processing cannot complete in this webhook invocation.
  }

  await markProcessedWebhookEvent(stripeEvent.id);

  return jsonWithRequestId(event, 200, { ok: true });
};
