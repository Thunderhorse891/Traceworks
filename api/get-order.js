import { getOrder } from './_lib/store.js';
import { sendJsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { verifyStatusToken } from './_lib/status-token.js';

export default async function handler(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.headers['client-ip'] || 'unknown';
  const limit = hitRateLimit({ key: `get-order:${ip}`, windowMs: 60_000, max: 60 });
  if (limit.limited) return sendJsonWithRequestId(req, res, 429, { error: 'Too many requests. Try again shortly.' });

  const { caseRef, statusToken, status_token, email } = req.query || {};
  const token = statusToken || status_token;
  const fallbackEmail = (email || '').toLowerCase().trim();

  if (!caseRef) return sendJsonWithRequestId(req, res, 400, { error: 'caseRef is required.' });

  const order = await getOrder(caseRef);
  if (!order) return sendJsonWithRequestId(req, res, 404, { error: 'Order not found.' });

  if (token) {
    const verified = verifyStatusToken(token);
    if (!verified.ok) return sendJsonWithRequestId(req, res, 403, { error: 'Invalid status token.' });
    if (verified.caseRef !== caseRef) return sendJsonWithRequestId(req, res, 403, { error: 'Status token does not match this case.' });
    if ((order.customerEmail || '').toLowerCase() !== verified.email) {
      return sendJsonWithRequestId(req, res, 403, { error: 'Status token does not match this case.' });
    }
  } else {
    if (!fallbackEmail) return sendJsonWithRequestId(req, res, 400, { error: 'statusToken or email is required.' });
    if ((order.customerEmail || '').toLowerCase() !== fallbackEmail) {
      return sendJsonWithRequestId(req, res, 403, { error: 'Email does not match this case.' });
    }
  }

  return sendJsonWithRequestId(req, res, 200, {
    caseRef: order.caseRef,
    status: order.status,
    packageId: order.packageId,
    packageName: order.packageName,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    queuedAt: order.queuedAt || null,
    completedAt: order.completedAt || null,
    lastAttemptAt: order.lastAttemptAt || null,
    retryAt: order.retryAt || null,
    lastError: order.lastError || null,
    fulfillmentAttempts: order.fulfillmentAttempts || 0
  });
}
