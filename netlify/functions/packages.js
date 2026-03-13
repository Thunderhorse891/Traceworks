import { PACKAGES } from './_lib/packages.js';
import { jsonWithRequestId } from './_lib/http.js';

/**
 * GET /api/packages
 *
 * Public endpoint returning the sellable active package list.
 * Used by the operator console workflows view and any client that needs
 * the authoritative package definitions without auth.
 *
 * Returns only packages with a fixed public price (amount > 0).
 * Custom/enterprise packages (amount === 0) are excluded — those are
 * scoped and priced separately outside this endpoint.
 */
export default async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonWithRequestId(event, 405, { error: 'Method not allowed' });
  }

  const packages = Object.values(PACKAGES)
    .filter((p) => p.amount > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      amount: p.amount,
      currency: p.currency,
      deliveryHours: p.deliveryHours,
      sla: p.sla,
      workflowTier: p.workflowTier,
      sections: p.sections,
    }));

  return jsonWithRequestId(event, 200, { packages });
};
