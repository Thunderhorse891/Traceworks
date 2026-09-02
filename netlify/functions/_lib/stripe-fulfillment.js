import { getPackage } from './packages.js';

function normalizeCurrency(value) {
  return String(value || '').trim().toLowerCase();
}

export function validatePaidCheckoutSession({ session, lineItem }) {
  if (!session || typeof session !== 'object') {
    return { ok: false, reason: 'missing_checkout_session' };
  }

  if (session.payment_status !== 'paid') {
    return { ok: false, reason: 'payment_not_paid' };
  }

  const packageId = String(session.metadata?.packageId || '').trim();
  const pkg = getPackage(packageId);
  if (!pkg) {
    return { ok: false, reason: 'unknown_package', packageId };
  }

  const sessionAmount = Number(session.amount_total);
  const lineAmount = Number(lineItem?.amount_total);
  const actualAmount = Number.isSafeInteger(sessionAmount) ? sessionAmount : lineAmount;
  if (!Number.isSafeInteger(actualAmount) || actualAmount !== pkg.amount) {
    return {
      ok: false,
      reason: 'amount_mismatch',
      expectedAmount: pkg.amount,
      actualAmount: Number.isFinite(actualAmount) ? actualAmount : null
    };
  }

  const actualCurrency = normalizeCurrency(session.currency || lineItem?.currency || lineItem?.price?.currency);
  if (!actualCurrency || actualCurrency !== normalizeCurrency(pkg.currency)) {
    return {
      ok: false,
      reason: 'currency_mismatch',
      expectedCurrency: normalizeCurrency(pkg.currency),
      actualCurrency: actualCurrency || null
    };
  }

  return { ok: true, pkg, packageId, amountTotal: actualAmount, currency: actualCurrency };
}
