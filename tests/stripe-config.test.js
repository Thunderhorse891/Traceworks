import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStripeSecretKey, validateStripeWebhookSecret } from '../netlify/functions/_lib/stripe-config.js';

test('validateStripeSecretKey accepts sk_ keys and rejects publishable keys', () => {
  assert.equal(validateStripeSecretKey('sk_test_123').ok, true);
  assert.equal(validateStripeSecretKey('sk_live_123').ok, true);
  const rejected = validateStripeSecretKey('mk_1RFGbTH4AWEdtmcMHyYwfOcn');
  assert.equal(rejected.ok, false);
  assert.ok(rejected.message.includes('publishable key'));
});

test('validateStripeWebhookSecret enforces whsec prefix', () => {
  assert.equal(validateStripeWebhookSecret('whsec_123').ok, true);
  assert.equal(validateStripeWebhookSecret('not-a-secret').ok, false);
});
