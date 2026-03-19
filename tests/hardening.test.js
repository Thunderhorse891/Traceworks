import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInputCriteria,
  normalizeCheckoutPayload,
  resolveInvestigationInput,
  validateCheckoutPayload
} from '../netlify/functions/_lib/validation.js';
import { resolveEmailSettings } from '../netlify/functions/_lib/email-config.js';
import { hitRateLimit } from '../netlify/functions/_lib/rate-limit.js';
import { jsonWithRequestId } from '../netlify/functions/_lib/http.js';
import { getBusinessEmail } from '../netlify/functions/_lib/business.js';
import { createStatusToken } from '../netlify/functions/_lib/status-token.js';

test('validation normalizes profile URL and validates URL', () => {
  const payload = normalizeCheckoutPayload({
    packageId: 'standard',
    customerName: 'Law Office',
    customerEmail: 'x@y.com',
    companyName: 'John Doe',
    county: 'Harris',
    websiteProfile: 'example.com',
    goals: 'Locate',
    legalConsent: 'true',
    tosConsent: 'true'
  });
  assert.equal(payload.website, 'https://example.com');
  assert.equal(validateCheckoutPayload(payload).length, 0);

  const bad = normalizeCheckoutPayload({ ...payload, websiteProfile: '://bad url' });
  assert.ok(validateCheckoutPayload(bad).some((e) => e.includes('URL is invalid')));
});

test('probate intake requires a secondary identifier for precision', () => {
  const payload = normalizeCheckoutPayload({
    packageId: 'probate_heirship',
    customerName: 'Law Office',
    customerEmail: 'x@y.com',
    subjectName: 'Jane Doe',
    county: 'Harris',
    legalConsent: 'true',
    tosConsent: 'true'
  });

  assert.ok(validateCheckoutPayload(payload).some((e) => e.includes('additional identifier')));
});

test('validation blocks prohibited screening and harassment purposes', () => {
  const screeningPayload = normalizeCheckoutPayload({
    packageId: 'standard',
    customerName: 'Law Office',
    customerEmail: 'x@y.com',
    subjectName: 'Jane Doe',
    county: 'Harris',
    goals: 'Run a tenant screening background check before lease approval',
    legalConsent: 'true',
    tosConsent: 'true'
  });

  const harassmentPayload = normalizeCheckoutPayload({
    packageId: 'standard',
    customerName: 'Law Office',
    customerEmail: 'x@y.com',
    subjectName: 'Jane Doe',
    county: 'Harris',
    requestedFindings: 'Help me find my ex so I can stalk them',
    legalConsent: 'true',
    tosConsent: 'true'
  });

  assert.ok(validateCheckoutPayload(screeningPayload).some((e) => e.includes('tenant screening')));
  assert.ok(validateCheckoutPayload(harassmentPayload).some((e) => e.includes('stalking')));
});

test('input criteria preserves structured investigation seeds', () => {
  const payload = normalizeCheckoutPayload({
    packageId: 'asset_network',
    customerName: 'Law Office',
    customerEmail: 'x@y.com',
    subjectName: 'Mercer Holdings LLC',
    subjectType: 'entity',
    county: 'Harris',
    state: 'tx',
    lastKnownAddress: '100 Main St, Houston, TX',
    parcelId: 'P-100',
    alternateNames: 'Mercer Holdings, Mercer Family Trust',
    subjectPhone: '(555) 111-2222',
    requestedFindings: 'Find related parcels, verify recorder hits',
    goals: 'Collections enforcement',
    legalConsent: 'true',
    tosConsent: 'true'
  });

  const criteria = buildInputCriteria(payload);
  assert.deepEqual(criteria.alternateNames, ['Mercer Holdings', 'Mercer Family Trust']);
  assert.equal(criteria.subjectType, 'entity');
  assert.ok(criteria.searchSeeds.includes('P-100'));
  assert.ok(criteria.searchSeeds.includes('100 Main St, Houston, TX'));
});

test('resolveInvestigationInput merges legacy order fields without losing structure', () => {
  const criteria = resolveInvestigationInput({
    subjectName: 'Jordan Mercer',
    county: 'Harris',
    state: 'TX',
    website: 'https://example.org/profile',
    input_criteria: {
      lastKnownAddress: '123 Main St',
      alternateNames: ['J. Mercer'],
      requestedFindings: 'Locate related parcels'
    }
  });

  assert.equal(criteria.subjectName, 'Jordan Mercer');
  assert.equal(criteria.lastKnownAddress, '123 Main St');
  assert.ok(criteria.alternateNames.includes('J. Mercer'));
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

test('email settings accept SMTP and from-address aliases', () => {
  const settings = resolveEmailSettings({
    SMTP_HOST: 'smtp-mail.outlook.com',
    SMTP_PORT: '587',
    SMTP_USERNAME: 'traceworks.tx@outlook.com',
    SMTP_PASSWORD: 'secret',
    FROM_ADDRESS: 'traceworks.tx@outlook.com'
  });

  assert.equal(settings.host, 'smtp-mail.outlook.com');
  assert.equal(settings.port, 587);
  assert.equal(settings.user, 'traceworks.tx@outlook.com');
  assert.equal(settings.pass, 'secret');
  assert.equal(settings.from, 'traceworks.tx@outlook.com');
});
