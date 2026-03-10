import Stripe from 'stripe';
import { getPackage } from './_lib/packages.js';
import { normalizeCheckoutPayload, validateCheckoutPayload } from './_lib/validation.js';
import { upsertOrder } from './_lib/store.js';
import { jsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { createStatusToken } from './_lib/status-token.js';
import { validateStripeSecretKey } from './_lib/stripe-config.js';

function makeCaseRef() {
  return `TW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export default async (event) => {
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

    const { packageId, customerName, customerEmail, companyName, website, goals } = payload;
    const pkg = getPackage(packageId);
    if (!pkg) return jsonWithRequestId(event, 400, { error: 'Invalid package selected.' });

    const stripeConfig = validateStripeSecretKey(process.env.STRIPE_SECRET_KEY);
    if (!stripeConfig.ok) return jsonWithRequestId(event, 500, { error: stripeConfig.message });

    const caseRef = makeCaseRef();
    await upsertOrder(caseRef, {
      status: 'checkout_created',
      packageId,
      packageName: pkg.name,
      customerName,
      customerEmail,
      subjectName: companyName,
      website,
      goals,
      fulfillmentAttempts: 0
    });

    const statusToken = createStatusToken({ caseRef, email: customerEmail });

    const stripe = new Stripe(stripeConfig.key);
    const base = process.env.URL || `https://${event.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: customerEmail,
      line_items: [{ price_data: { currency: pkg.currency, product_data: { name: pkg.name }, unit_amount: pkg.amount }, quantity: 1 }],
      metadata: { caseRef, packageId, packageName: pkg.name, customerName, customerEmail, companyName, website, goals, legalConsent: 'true', tosConsent: 'true' },
      success_url: `${base}/success.html?session_id={CHECKOUT_SESSION_ID}&case_ref=${caseRef}${statusToken ? `&status_token=${encodeURIComponent(statusToken)}` : `&email=${encodeURIComponent(customerEmail)}`}`,
      cancel_url: `${base}/cancel.html`
    });

    return jsonWithRequestId(event, 200, { checkoutUrl: session.url, caseRef, statusTokenIssued: Boolean(statusToken) });
  } catch (error) {
    return jsonWithRequestId(event, 500, { error: error.message });
  }
};
