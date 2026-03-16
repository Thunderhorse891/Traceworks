import Stripe from 'stripe';
import { getPackage } from './_lib/packages.js';
import { buildInputCriteria, normalizeCheckoutPayload, validateCheckoutPayload } from './_lib/validation.js';
import { upsertOrder } from './_lib/store.js';
import { jsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { createStatusToken } from './_lib/status-token.js';
import { validateStripeSecretKey } from './_lib/stripe-config.js';
import { ORDER_STATUS } from './_lib/order-status.js';
import { resolvePurchasedTier } from './_lib/tier-mapping.js';
import { assessOrderLaunchGate } from './_lib/launch-audit.js';
import { buildCheckoutSessionPayload } from './_lib/stripe-checkout.js';
import { createModernHandler } from './_lib/netlify-modern.js';

function makeCaseRef() {
  return `TW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

    const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
    const limit = hitRateLimit({ key: `checkout:${ip}`, windowMs: 60_000, max: 20 });
    if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests. Try again shortly.' });

    let rawPayload = {};
    try {
      rawPayload = JSON.parse(event.body || '{}');
    } catch {
      return jsonWithRequestId(event, 400, { error: 'Invalid JSON payload.' });
    }

    const payload = normalizeCheckoutPayload(rawPayload);
    const errors = validateCheckoutPayload(payload);
    if (errors.length) return jsonWithRequestId(event, 400, { error: errors[0], errors });

    const { packageId, customerName, customerEmail, subjectName, county, state, goals } = payload;
    const pkg = getPackage(packageId);
    if (!pkg) return jsonWithRequestId(event, 400, { error: 'Invalid package selected.' });
    const inputCriteria = buildInputCriteria(payload);
    const launchGate = assessOrderLaunchGate(packageId, inputCriteria, process.env);
    if (!launchGate.launchReady) {
      return jsonWithRequestId(event, 503, {
        error: launchGate.launchMessage,
        launchBlocked: true,
        blockingAreas: launchGate.launchBlockingAreas,
        blockingDetails: launchGate.launchBlockingDetails
      });
    }

    const stripeConfig = validateStripeSecretKey(process.env.STRIPE_SECRET_KEY);
    if (!stripeConfig.ok) return jsonWithRequestId(event, 500, { error: stripeConfig.message });

    const caseRef = makeCaseRef();
    const purchasedTier = resolvePurchasedTier({ packageId });
    await upsertOrder(caseRef, {
      order_id: caseRef,
      status: ORDER_STATUS.PENDING_PAYMENT,
      packageId,
      packageName: pkg.name,
      amountTotal: pkg.amount,
      currency: pkg.currency,
      purchased_tier: purchasedTier,
      customerName,
      customerEmail,
      subjectName,
      subjectType: inputCriteria.subjectType,
      county,
      state,
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
      goals,
      input_criteria: inputCriteria,
      coverage_assessment: launchGate.orderCoverage || null,
      manualReviewLikely: Boolean(launchGate.manualReviewLikely),
      manualReviewIndicators: launchGate.manualReviewDetails || [],
      stripe_checkout_session_id: null,
      stripe_payment_intent_id: null,
      artifact_url_or_path: null,
      started_at: null,
      completed_at: null,
      failure_reason: null,
      email_delivery_status: 'pending',
      fulfillmentAttempts: 0
    });

    const statusToken = createStatusToken({ caseRef, email: customerEmail });

    const stripe = new Stripe(stripeConfig.key);
    const base = process.env.URL || `https://${event.headers.host}`;
    const session = await stripe.checkout.sessions.create(buildCheckoutSessionPayload({
      pkg,
      caseRef,
      customerName,
      customerEmail,
      subjectName,
      county,
      state,
      inputCriteria,
      baseUrl: base,
      statusToken
    }));

    await upsertOrder(caseRef, {
      stripe_checkout_session_id: session.id,
      amountTotal: pkg.amount,
      currency: pkg.currency
    });

    return jsonWithRequestId(event, 200, { checkoutUrl: session.url, caseRef, statusTokenIssued: Boolean(statusToken) });
  } catch (error) {
    return jsonWithRequestId(event, 500, { error: error.message });
  }
}

export default createModernHandler(handler);
