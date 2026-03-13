import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCheckoutPayload, validateCheckoutPayload } from './netlify/functions/_lib/validation.js';
import { hitRateLimit } from './netlify/functions/_lib/rate-limit.js';
import { jsonWithRequestId } from './netlify/functions/_lib/http.js';
import { getBusinessEmail } from './netlify/functions/_lib/business.js';
import { createStatusToken } from './netlify/functions/_lib/status-token.js';

test('validation normalizes website and validates URL', () => {
  const payload = normalizeCheckoutPayload({
    packageId: 'standard',
    customerName: 'Law Office',
    customerEmail: 'x@y.com',
    companyName: 'John Doe',
    county: 'Harris',
    website: 'example.com',
    goals: 'Locate',
    legalConsent: 'true',
    tosConsent: 'true'
  });
  assert.equal(payload.website, 'https://example.com');
  assert.equal(validateCheckoutPayload(payload).length, 0);

  const bad = normalizeCheckoutPayload({ ...payload, website: '://bad url' });
  assert.ok(validateCheckoutPayload(bad).some((e) => e.includes('URL is invalid')));
});

test('rate limiter limits after threshold', () => {
  const key = `test:${Date.now()}`;
  let limited = false;
  for (let i = 0; i < 5; i++) {
    const r = hitRateLimit({ key, windowMs: 60_000, max: 3 });
    limited = r.limited;
  }
  assert.equal(limited, true);
});

test('jsonWithRequestId injects request id', () => {
  const r = jsonWithRequestId({ headers: {} }, 200, { ok: true });
  const body = JSON.parse(r.body);
  assert.ok(body.requestId);
  assert.equal(r.headers['x-request-id'].length > 0, true);
});


test('business email defaults to traceworks mailbox', () => {
  const prior = process.env.OWNER_EMAIL;
  delete process.env.OWNER_EMAIL;
  assert.equal(getBusinessEmail(), 'traceworks.tx@outlook.com');
  process.env.OWNER_EMAIL = 'custom@example.com';
  assert.equal(getBusinessEmail(), 'custom@example.com');
  if (prior) process.env.OWNER_EMAIL = prior; else delete process.env.OWNER_EMAIL;
});


test('status token is disabled when STATUS_TOKEN_SECRET is missing', () => {
  const priorStatus = process.env.STATUS_TOKEN_SECRET;
  const priorAdmin = process.env.ADMIN_API_KEY;
  const priorStripe = process.env.STRIPE_SECRET_KEY;
  delete process.env.STATUS_TOKEN_SECRET;
  process.env.ADMIN_API_KEY = 'x';
  process.env.STRIPE_SECRET_KEY = 'y';
  assert.equal(createStatusToken({ caseRef: 'TW-X', email: 'a@b.com' }), null);
  if (priorStatus) process.env.STATUS_TOKEN_SECRET = priorStatus; else delete process.env.STATUS_TOKEN_SECRET;
  if (priorAdmin) process.env.ADMIN_API_KEY = priorAdmin; else delete process.env.ADMIN_API_KEY;
  if (priorStripe) process.env.STRIPE_SECRET_KEY = priorStripe; else delete process.env.STRIPE_SECRET_KEY;
});
