import test from 'node:test';
import assert from 'node:assert/strict';

import { validatePaidCheckoutSession } from '../netlify/functions/_lib/stripe-fulfillment.js';

function paidSession(overrides = {}) {
  return {
    id: 'cs_test_123',
    payment_status: 'paid',
    amount_total: 9900,
    currency: 'usd',
    metadata: { packageId: 'standard' },
    ...overrides
  };
}

test('paid checkout reconciliation accepts the exact package amount and currency', () => {
  const result = validatePaidCheckoutSession({ session: paidSession(), lineItem: {} });
  assert.equal(result.ok, true);
  assert.equal(result.packageId, 'standard');
  assert.equal(result.amountTotal, 9900);
});

test('checkout completion does not authorize fulfillment while payment is unpaid', () => {
  const result = validatePaidCheckoutSession({
    session: paidSession({ payment_status: 'unpaid' }),
    lineItem: {}
  });
  assert.deepEqual(result, { ok: false, reason: 'payment_not_paid' });
});

test('checkout reconciliation blocks package amount tampering', () => {
  const result = validatePaidCheckoutSession({
    session: paidSession({ amount_total: 100 }),
    lineItem: {}
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'amount_mismatch');
  assert.equal(result.expectedAmount, 9900);
  assert.equal(result.actualAmount, 100);
});

test('checkout reconciliation blocks a currency mismatch and an unknown package', () => {
  const wrongCurrency = validatePaidCheckoutSession({
    session: paidSession({ currency: 'eur' }),
    lineItem: {}
  });
  assert.equal(wrongCurrency.ok, false);
  assert.equal(wrongCurrency.reason, 'currency_mismatch');

  const unknownPackage = validatePaidCheckoutSession({
    session: paidSession({ metadata: { packageId: 'forged' } }),
    lineItem: {}
  });
  assert.equal(unknownPackage.ok, false);
  assert.equal(unknownPackage.reason, 'unknown_package');
});
