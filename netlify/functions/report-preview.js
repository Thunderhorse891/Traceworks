import { jsonWithRequestId } from './_lib/http.js';
import { createModernHandler } from './_lib/netlify-modern.js';

export async function handler(event) {
  return jsonWithRequestId(event, 410, {
    error: 'Sample report previews have been retired from the production deployment.',
    next: 'Use /packages.html for live package coverage and /api/order-artifact for authenticated report delivery.'
  });
}

export default createModernHandler(handler);
