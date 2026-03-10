import Stripe from 'stripe';
import { enqueueJob, isProcessedWebhookEvent, markProcessedWebhookEvent, upsertOrder } from './_lib/store.js';
import { sendJsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';

// Vercel must not parse the body — we need the raw buffer for Stripe signature verification
export const config = { api: { bodyParser: false } };

const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJsonWithRequestId(req, res, 405, { error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || req.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `webhook:${ip}`, windowMs: 60_000, max: 120 });
  if (limit.limited) return sendJsonWithRequestId(req, res, 429, { error: 'Too many requests.' });

  const body = await readRawBody(req);
  if (Buffer.byteLength(body, 'utf8') > MAX_WEBHOOK_BODY_BYTES) {
    return sendJsonWithRequestId(req, res, 413, { error: 'Webhook payload too large.' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    return sendJsonWithRequestId(req, res, 500, { error: 'Missing required environment variables.' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) return sendJsonWithRequestId(req, res, 400, { error: 'Missing stripe-signature header.' });

  const stripe = new Stripe(stripeKey);
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(body, sig, webhookSecret, 300);
  } catch (err) {
    return sendJsonWithRequestId(req, res, 400, { error: `Webhook Error: ${err.message}` });
  }

  if (await isProcessedWebhookEvent(stripeEvent.id)) {
    return sendJsonWithRequestId(req, res, 200, { ok: true, duplicate: true });
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    await markProcessedWebhookEvent(stripeEvent.id);
    return sendJsonWithRequestId(req, res, 200, { ok: true, ignored: true });
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
    subjectName: metadata.subjectName,
    county: metadata.county,
    state: metadata.state,
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
      subjectName: metadata.subjectName,
      county: metadata.county,
      state: metadata.state,
      website: metadata.website,
      goals: metadata.goals
    }
  });

  await markProcessedWebhookEvent(stripeEvent.id);

  return sendJsonWithRequestId(req, res, 200, { ok: true });
}
