import Stripe from 'stripe';
import { enqueueJob, isProcessedWebhookEvent, markProcessedWebhookEvent, upsertOrder } from './_lib/store.js';
import { jsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';

export default async (event) => {
  if (event.httpMethod !== 'POST') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

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
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    return jsonWithRequestId(event, 400, { error: `Webhook Error: ${err.message}` });
  }

  if (await isProcessedWebhookEvent(stripeEvent.id)) return jsonWithRequestId(event, 200, { ok: true, duplicate: true });

  if (stripeEvent.type === 'checkout.session.completed') {
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

    await markProcessedWebhookEvent(stripeEvent.id);
  }

  return jsonWithRequestId(event, 200, { ok: true });
};
