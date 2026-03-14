import { jsonWithRequestId } from './_lib/http.js';

export default async (event) => {
  return jsonWithRequestId(event, 410, {
    error: 'Sample report previews have been retired from the production deployment.',
    next: 'Use /packages.html for live package coverage and /api/order-artifact for authenticated report delivery.'
  });
};
