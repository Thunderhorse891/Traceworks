import { getOrder } from './_lib/store.js';
import { jsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { verifyStatusToken } from './_lib/status-token.js';

export default async (event) => {
  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `get-order:${ip}`, windowMs: 60_000, max: 60 });
  if (limit.limited) return jsonWithRequestId(event, 429, { error: 'Too many requests. Try again shortly.' });

  const caseRef = event.queryStringParameters?.caseRef;
  const statusToken = event.queryStringParameters?.statusToken || event.queryStringParameters?.status_token;
  const fallbackEmail = (event.queryStringParameters?.email || '').toLowerCase().trim();
  if (!caseRef) return jsonWithRequestId(event, 400, { error: 'caseRef is required.' });

  const order = await getOrder(caseRef);
  if (!order) return jsonWithRequestId(event, 404, { error: 'Order not found.' });

  if (statusToken) {
    const verified = verifyStatusToken(statusToken);
    if (!verified.ok) return jsonWithRequestId(event, 403, { error: 'Invalid status token.' });
    if (verified.caseRef !== caseRef) return jsonWithRequestId(event, 403, { error: 'Status token does not match this case.' });
    if ((order.customerEmail || '').toLowerCase() !== verified.email) {
      return jsonWithRequestId(event, 403, { error: 'Status token does not match this case.' });
    }
  } else {
    if (!fallbackEmail) return jsonWithRequestId(event, 400, { error: 'statusToken or email is required.' });
    if ((order.customerEmail || '').toLowerCase() !== fallbackEmail) {
      return jsonWithRequestId(event, 403, { error: 'Email does not match this case.' });
    }
  }

  return jsonWithRequestId(event, 200, {
    order_id: order.order_id || order.caseRef,
    caseRef: order.caseRef,
    status: order.status,
    purchased_tier: order.purchased_tier || null,
    stripe_checkout_session_id: order.stripe_checkout_session_id || null,
    stripe_payment_intent_id: order.stripe_payment_intent_id || null,
    packageId: order.packageId,
    packageName: order.packageName,
    artifact_url_or_path: order.artifact_url_or_path || null,
    started_at: order.started_at || null,
    completed_at: order.completed_at || null,
    failure_reason: order.failure_reason || null,
    email_delivery_status: order.email_delivery_status || null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    queuedAt: order.queuedAt || null,
    completedAt: order.completedAt || null,
    lastAttemptAt: order.lastAttemptAt || null,
    retryAt: order.retryAt || null,
    lastError: order.lastError || null,
    fulfillmentAttempts: order.fulfillmentAttempts || 0
  });
};
