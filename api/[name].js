import adminActions from '../netlify/functions/admin-actions.js';
import adminCaseDebug from '../netlify/functions/admin-case-debug.js';
import adminLogin from '../netlify/functions/admin-login.js';
import adminLogout from '../netlify/functions/admin-logout.js';
import adminMetrics from '../netlify/functions/admin-metrics.js';
import adminOrders from '../netlify/functions/admin-orders.js';
import contactSales from '../netlify/functions/contact-sales.js';
import createCheckout from '../netlify/functions/create-checkout.js';
import getOrder from '../netlify/functions/get-order.js';
import health from '../netlify/functions/health.js';
import intakePreflight from '../netlify/functions/intake-preflight.js';
import launchAudit from '../netlify/functions/launch-audit.js';
import orderArtifact from '../netlify/functions/order-artifact.js';
import packages from '../netlify/functions/packages.js';
import processQueueScheduled from '../netlify/functions/process-queue-scheduled.js';
import processQueue from '../netlify/functions/process-queue.js';
import reportPreview from '../netlify/functions/report-preview.js';
import sourceProof from '../netlify/functions/source-proof.js';
import stripeWebhook from '../netlify/functions/stripe-webhook.js';
import trackEvent from '../netlify/functions/track-event.js';

const HANDLERS = Object.freeze({
  'admin-actions': adminActions,
  'admin-case-debug': adminCaseDebug,
  'admin-login': adminLogin,
  'admin-logout': adminLogout,
  'admin-metrics': adminMetrics,
  'admin-orders': adminOrders,
  'contact-sales': contactSales,
  'create-checkout': createCheckout,
  'get-order': getOrder,
  health,
  'intake-preflight': intakePreflight,
  'launch-audit': launchAudit,
  'order-artifact': orderArtifact,
  packages,
  'process-queue-cron': processQueueScheduled,
  'process-queue': processQueue,
  'report-preview': reportPreview,
  'source-proof': sourceProof,
  'stripe-webhook': stripeWebhook,
  'track-event': trackEvent
});

function routeName(request) {
  const url = new URL(request.url);
  return decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || '');
}

export default async function vercelApiDispatcher(request) {
  const name = routeName(request);
  const handler = HANDLERS[name];
  if (!handler) {
    return Response.json({ error: 'API route not found.' }, { status: 404 });
  }

  console.log('[vercel-api] request', { name, method: request.method });
  try {
    return await handler(request);
  } catch (error) {
    console.error('[vercel-api] unhandled failure', {
      name,
      method: request.method,
      error: String(error?.message || error),
      stack: error?.stack
    });
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export const config = {
  maxDuration: 300
};
