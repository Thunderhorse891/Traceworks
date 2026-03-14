import Stripe from 'stripe';
import { enqueueJob, getOrder, isProcessedWebhookEvent, markProcessedWebhookEvent, upsertOrder } from './_lib/store.js';
import { jsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { processOneFulfillmentJob } from './_lib/process-one-job.js';
import { getBusinessEmail } from './_lib/business.js';
import { validateStripeSecretKey, validateStripeWebhookSecret } from './_lib/stripe-config.js';
import { ORDER_STATUS } from './_lib/order-status.js';
import { resolvePurchasedTier } from './_lib/tier-mapping.js';
import { recordAuditEvent } from './_lib/store.js';
import { buildInputCriteria, normalizeCheckoutPayload } from './_lib/validation.js';
import { getPackage } from './_lib/packages.js';
import { createStatusToken } from './_lib/status-token.js';
import { sendOrderConfirmationEmail } from './_lib/email.js';

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

  const stripeConfig = validateStripeSecretKey(process.env.STRIPE_SECRET_KEY);
  const webhookConfig = validateStripeWebhookSecret(process.env.STRIPE_WEBHOOK_SECRET);
  if (!stripeConfig.ok || !webhookConfig.ok) {
    return jsonWithRequestId(event, 500, { error: stripeConfig.ok ? webhookConfig.message : stripeConfig.message });
  }

  const sig = event.headers['stripe-signature'];
  if (!sig) return jsonWithRequestId(event, 400, { error: 'Missing stripe-signature header.' });

  const stripe = new Stripe(stripeConfig.key);
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(body, sig, webhookConfig.secret, 300);
  } catch (err) {
    return jsonWithRequestId(event, 400, { error: `Webhook Error: ${err.message}` });
  }

  if (await isProcessedWebhookEvent(stripeEvent.id)) return jsonWithRequestId(event, 200, { ok: true, duplicate: true });

  if (stripeEvent.type === 'charge.refunded') {
    const charge = stripeEvent.data.object;
    await upsertOrder(charge.metadata?.caseRef || `TW-${charge.payment_intent}`, {
      status: ORDER_STATUS.REFUNDED,
      failure_reason: 'Payment refunded by Stripe.',
      completed_at: new Date().toISOString()
    });
    await markProcessedWebhookEvent(stripeEvent.id);
    return jsonWithRequestId(event, 200, { ok: true, refunded: true });
  }

  if (stripeEvent.type === 'checkout.session.expired') {
    const expired = stripeEvent.data.object;
    const expiredCaseRef = expired.metadata?.caseRef || `TW-${expired.id}`;
    await upsertOrder(expiredCaseRef, {
      status: ORDER_STATUS.CANCELED,
      failure_reason: 'Checkout session expired before payment completion.'
    });
    await markProcessedWebhookEvent(stripeEvent.id);
    return jsonWithRequestId(event, 200, { ok: true, canceled: true });
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    await markProcessedWebhookEvent(stripeEvent.id);
    return jsonWithRequestId(event, 200, { ok: true, ignored: true });
  }

  const session = stripeEvent.data.object;
  const metadata = session.metadata || {};
  const caseRef = metadata.caseRef || `TW-${session.id}`;
  const existingOrder = await getOrder(caseRef);

  let stripePriceId = null;
  let stripeProductId = null;
  let amountTotal = null;
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    const first = lineItems?.data?.[0];
    stripePriceId = first?.price?.id || null;
    stripeProductId = first?.price?.product || null;
    amountTotal = first?.amount_total || first?.price?.unit_amount || null;
  } catch {}

  const purchasedTier = resolvePurchasedTier({
    packageId: metadata.packageId,
    stripePriceId,
    stripeProductId
  });
  const normalized = normalizeCheckoutPayload({
    packageId: metadata.packageId || existingOrder?.packageId || '',
    customerName: metadata.customerName || existingOrder?.customerName || '',
    customerEmail: metadata.customerEmail || existingOrder?.customerEmail || session.customer_details?.email || '',
    subjectName: metadata.subjectName || existingOrder?.subjectName || existingOrder?.input_criteria?.subjectName || '',
    subjectType: metadata.subjectType || existingOrder?.subjectType || existingOrder?.input_criteria?.subjectType || '',
    county: metadata.county || existingOrder?.county || existingOrder?.input_criteria?.county || '',
    state: metadata.state || existingOrder?.state || existingOrder?.input_criteria?.state || 'TX',
    lastKnownAddress: existingOrder?.lastKnownAddress || existingOrder?.input_criteria?.lastKnownAddress || '',
    websiteProfile: existingOrder?.websiteProfile || existingOrder?.input_criteria?.websiteProfile || existingOrder?.website || existingOrder?.input_criteria?.website || '',
    parcelId: existingOrder?.parcelId || existingOrder?.input_criteria?.parcelId || '',
    alternateNames: existingOrder?.alternateNames || existingOrder?.input_criteria?.alternateNames || [],
    dateOfBirth: existingOrder?.dateOfBirth || existingOrder?.input_criteria?.dateOfBirth || '',
    deathYear: existingOrder?.deathYear || existingOrder?.input_criteria?.deathYear || '',
    subjectPhone: existingOrder?.subjectPhone || existingOrder?.input_criteria?.subjectPhone || '',
    subjectEmail: existingOrder?.subjectEmail || existingOrder?.input_criteria?.subjectEmail || '',
    requestedFindings: existingOrder?.requestedFindings || existingOrder?.input_criteria?.requestedFindings || '',
    goals: existingOrder?.goals || existingOrder?.input_criteria?.goals || '',
    legalConsent: true,
    tosConsent: true
  });
  const inputCriteria = buildInputCriteria(normalized);
  const pkg = getPackage(metadata.packageId || existingOrder?.packageId || '');

  await recordAuditEvent({ event: 'payment_verified', caseRef, stripeEventId: stripeEvent.id, stripeSessionId: session.id, purchasedTier });

  await upsertOrder(caseRef, {
    order_id: caseRef,
    status: ORDER_STATUS.PAID,
    stripeSessionId: session.id,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent || null,
    packageId: metadata.packageId,
    packageName: metadata.packageName,
    amountTotal,
    currency: session.currency || null,
    purchased_tier: purchasedTier,
    customerName: metadata.customerName || existingOrder?.customerName,
    customerEmail: metadata.customerEmail || session.customer_details?.email || existingOrder?.customerEmail,
    subjectName: inputCriteria.subjectName,
    subjectType: inputCriteria.subjectType,
    county: inputCriteria.county || '',
    state: inputCriteria.state || 'TX',
    lastKnownAddress: inputCriteria.lastKnownAddress,
    websiteProfile: inputCriteria.websiteProfile,
    website: inputCriteria.websiteProfile,
    parcelId: inputCriteria.parcelId,
    alternateNames: inputCriteria.alternateNames,
    dateOfBirth: inputCriteria.dateOfBirth,
    deathYear: inputCriteria.deathYear,
    subjectPhone: inputCriteria.subjectPhone,
    subjectEmail: inputCriteria.subjectEmail,
    requestedFindings: inputCriteria.requestedFindings,
    goals: inputCriteria.goals,
    input_criteria: inputCriteria,
    queuedAt: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    artifact_url_or_path: null,
    failure_reason: null,
    email_delivery_status: 'pending'
  });

  await upsertOrder(caseRef, { status: ORDER_STATUS.QUEUED });

  const ownerEmail = getBusinessEmail();
  const base = process.env.URL || `https://${event.headers.host}`;
  const statusToken = createStatusToken({ caseRef, email: metadata.customerEmail || session.customer_details?.email || existingOrder?.customerEmail || '' });
  const statusUrl = `${base}/order-status.html?caseRef=${encodeURIComponent(caseRef)}${statusToken ? `&status_token=${encodeURIComponent(statusToken)}` : ''}`;

  try {
    await sendOrderConfirmationEmail({
      ownerEmail,
      customerEmail: metadata.customerEmail || session.customer_details?.email || existingOrder?.customerEmail,
      caseRef,
      packageName: metadata.packageName || existingOrder?.packageName || pkg?.name || metadata.packageId || 'TraceWorks order',
      subjectName: inputCriteria.subjectName,
      county: inputCriteria.county,
      state: inputCriteria.state,
      deliveryHours: pkg?.deliveryHours || existingOrder?.deliveryHours || null,
      statusUrl,
      intakeSummary: inputCriteria.investigationBrief,
    });
    await upsertOrder(caseRef, { payment_confirmation_email_status: 'sent' });
    await recordAuditEvent({ event: 'payment_confirmation_email_sent', caseRef });
  } catch (error) {
    await upsertOrder(caseRef, { payment_confirmation_email_status: 'failed' });
    await recordAuditEvent({ event: 'payment_confirmation_email_failed', caseRef, error: String(error?.message || error) });
  }

  await enqueueJob({
    type: 'fulfillment',
    payload: {
      caseRef,
      orderId: caseRef,
      purchasedTier,
      packageId: metadata.packageId,
      customerName: metadata.customerName || existingOrder?.customerName,
      customerEmail: metadata.customerEmail || session.customer_details?.email || existingOrder?.customerEmail,
      subjectName: inputCriteria.subjectName,
      county: inputCriteria.county,
      state: inputCriteria.state,
      searchSeeds: inputCriteria.searchSeeds
    }
  });

  await recordAuditEvent({ event: 'order_queued_for_fulfillment', caseRef, purchasedTier });

  // Best-effort immediate fulfillment kick-off for this exact case so paid orders begin processing right away.
  const immediateMs = Math.max(500, Number(process.env.IMMEDIATE_FULFILLMENT_TIMEOUT_MS || 3500));
  try {
    await Promise.race([
      processOneFulfillmentJob({ ownerEmail, maxAttempts: 5, caseRef }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('immediate processing timeout')), immediateMs))
    ]);
    await recordAuditEvent({ event: 'immediate_fulfillment_attempt_finished', caseRef });
  } catch {
    // Scheduled queue worker will continue retries if immediate processing cannot complete in this webhook invocation.
    await recordAuditEvent({ event: 'immediate_fulfillment_attempt_deferred', caseRef });
  }

  await markProcessedWebhookEvent(stripeEvent.id);

  return jsonWithRequestId(event, 200, { ok: true });
};
