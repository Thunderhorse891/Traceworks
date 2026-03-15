import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCheckoutSessionPayload } from '../netlify/functions/_lib/stripe-checkout.js';

test('buildCheckoutSessionPayload adds Stripe reconciliation and receipt fields', () => {
  const payload = buildCheckoutSessionPayload({
    pkg: {
      id: 'standard',
      name: 'Standard Property Snapshot',
      currency: 'usd',
      amount: 9900
    },
    caseRef: 'TW-123',
    customerName: 'Law Office',
    customerEmail: 'client@example.com',
    subjectName: 'Jordan Mercer',
    county: 'Harris',
    state: 'TX',
    inputCriteria: { subjectType: 'person' },
    baseUrl: 'https://traceworks.example.com',
    statusToken: 'status-token'
  });

  assert.equal(payload.client_reference_id, 'TW-123');
  assert.equal(payload.customer_creation, 'always');
  assert.equal(payload.payment_intent_data.receipt_email, 'client@example.com');
  assert.equal(payload.payment_intent_data.metadata.caseRef, 'TW-123');
  assert.ok(payload.success_url.includes('status_token=status-token'));
});
