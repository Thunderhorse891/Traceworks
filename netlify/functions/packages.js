import { PACKAGES } from './_lib/packages.js';
import { jsonWithRequestId } from './_lib/http.js';

/**
 * GET /api/packages
 *
 * Public endpoint returning the canonical active package list.
 * Used by the operator console workflows view and any client that needs
 * the authoritative package definitions without auth.
 *
 * Only active packages (those in PACKAGES) are returned.
 * Legacy IDs (standard, ownership_encumbrance, etc.) are excluded.
 */
export default async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonWithRequestId(event, 405, { error: 'Method not allowed' });
  }

  const packages = Object.values(PACKAGES).map((p) => ({
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
