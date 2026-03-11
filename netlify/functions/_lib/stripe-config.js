const SECRET_PREFIXES = ['sk_live_', 'sk_test_'];
const PUBLISHABLE_PREFIXES = ['pk_live_', 'pk_test_', 'mk_live_', 'mk_test_', 'pk_', 'mk_'];

export function validateStripeSecretKey(value) {
  const key = String(value || '').trim();
  if (!key) return { ok: false, message: 'Stripe secret key is missing.' };
  if (PUBLISHABLE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    return { ok: false, message: 'Configured STRIPE_SECRET_KEY looks like a publishable key. Use a Stripe secret key (sk_live_... or sk_test_...).'};
  }
  if (!SECRET_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    return { ok: false, message: 'Configured STRIPE_SECRET_KEY format is invalid.' };
  }
  return { ok: true, key };
}

export function validateStripeWebhookSecret(value) {
  const secret = String(value || '').trim();
  if (!secret) return { ok: false, message: 'Stripe webhook secret is missing.' };
  if (!secret.startsWith('whsec_')) {
    return { ok: false, message: 'Configured STRIPE_WEBHOOK_SECRET format is invalid.' };
  }
  return { ok: true, secret };
}
