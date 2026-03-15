import test from 'node:test';
import assert from 'node:assert/strict';

import { assessPackageLaunchGate, auditLaunchReadiness } from '../netlify/functions/_lib/launch-audit.js';

test('launch audit blocks file storage and missing launch secrets', () => {
  const result = auditLaunchReadiness({
    URL: 'https://traceworks.app',
    STRIPE_SECRET_KEY: 'sk_live_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_123',
    SMTP_HOST: 'smtp-mail.outlook.com',
    SMTP_USER: 'traceworks@example.com',
    SMTP_PASS: 'secret',
    ADMIN_API_KEY: '',
    STATUS_TOKEN_SECRET: '',
    QUEUE_CRON_SECRET: '',
    TRACEWORKS_STORAGE_DRIVER: 'file',
    APPRAISAL_API_URL: 'https://sources.example/appraisal',
    TAX_COLLECTOR_API_URL: 'https://sources.example/tax',
    PARCEL_GIS_API_URL: 'https://sources.example/gis',
    COUNTY_CLERK_API_URL: 'https://sources.example/clerk',
    GRANTOR_GRANTEE_API_URL: 'https://sources.example/grantor',
    MORTGAGE_INDEX_API_URL: 'https://sources.example/mortgage',
    OBITUARY_API_URL: 'https://sources.example/obits',
    PROBATE_API_URL: 'https://sources.example/probate',
    PEOPLE_ASSOC_API_URL: '',
    PEOPLE_ASSOC_LICENSED: 'false',
    PUBLIC_RECORD_SOURCE_CONFIG: JSON.stringify({
      countyProperty: [{ id: 'property', type: 'html' }],
      countyRecorder: [{ id: 'recorder', type: 'html' }],
      probateIndex: [{ id: 'probate', type: 'html' }],
      entitySearch: [{ id: 'entity', type: 'json' }]
    })
  });

  assert.equal(result.ok, false);
  assert.ok(result.blockingCount >= 4);
  assert.ok(result.checks.some((check) => check.id === 'storage_driver' && check.status === 'fail'));
  assert.ok(result.checks.some((check) => check.id === 'admin_api_key' && check.status === 'fail'));
  assert.ok(result.checks.some((check) => check.id === 'people_association_source' && check.status === 'fail'));
  assert.equal(Array.isArray(result.packageReadiness), true);
});

test('launch audit warns when production still points at netlify and test stripe', () => {
  const result = auditLaunchReadiness({
    URL: 'https://traceworks.netlify.app',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_123',
    SMTP_HOST: 'smtp-mail.outlook.com',
    SMTP_USER: 'traceworks@example.com',
    SMTP_PASS: 'secret',
    EMAIL_FROM: 'TraceWorks <ops@example.com>',
    OWNER_EMAIL: 'ops@example.com',
    ADMIN_API_KEY: 'admin',
    STATUS_TOKEN_SECRET: 'status',
    QUEUE_CRON_SECRET: 'queue',
    TRACEWORKS_STORAGE_DRIVER: 'kv',
    UPSTASH_REDIS_REST_URL: 'https://kv.example.com',
    UPSTASH_REDIS_REST_TOKEN: 'kv-secret',
    APPRAISAL_API_URL: 'https://sources.example/appraisal',
    TAX_COLLECTOR_API_URL: 'https://sources.example/tax',
    PARCEL_GIS_API_URL: 'https://sources.example/gis',
    COUNTY_CLERK_API_URL: 'https://sources.example/clerk',
    GRANTOR_GRANTEE_API_URL: 'https://sources.example/grantor',
    MORTGAGE_INDEX_API_URL: 'https://sources.example/mortgage',
    OBITUARY_API_URL: 'https://sources.example/obits',
    PROBATE_API_URL: 'https://sources.example/probate',
    PEOPLE_ASSOC_API_URL: 'https://sources.example/people',
    PEOPLE_ASSOC_LICENSED: 'true',
    PUBLIC_RECORD_SOURCE_CONFIG: JSON.stringify({
      countyProperty: [{ id: 'property', type: 'html' }],
      countyRecorder: [{ id: 'recorder', type: 'browser' }],
      probateIndex: [{ id: 'probate', type: 'html' }],
      entitySearch: [{ id: 'entity', type: 'json' }]
    })
  });

  assert.equal(result.ok, true);
  assert.ok(result.warningCount >= 2);
  assert.ok(result.checks.some((check) => check.id === 'base_url' && check.status === 'warn'));
  assert.ok(result.checks.some((check) => check.id === 'stripe_secret' && check.status === 'warn'));
  assert.ok(result.checks.some((check) => check.id === 'premium_osint' && check.status === 'warn'));
  assert.ok(result.checks.some((check) => check.id === 'browser_sources' && check.status === 'warn'));
  assert.ok(result.checks.some((check) => check.id === 'bundled_source_catalog' && check.status === 'pass'));
  assert.ok(result.checks.some((check) => check.id === 'property_source_modules' && check.status === 'pass'));
});

test('launch audit warns when only the bundled Texas-first source catalog is active', () => {
  const result = auditLaunchReadiness({
    URL: 'https://traceworks.app',
    STRIPE_SECRET_KEY: 'sk_live_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_123',
    SMTP_HOST: 'smtp-mail.outlook.com',
    SMTP_USER: 'traceworks@example.com',
    SMTP_PASS: 'secret',
    EMAIL_FROM: 'TraceWorks <ops@example.com>',
    OWNER_EMAIL: 'ops@example.com',
    ADMIN_API_KEY: 'admin',
    STATUS_TOKEN_SECRET: 'status',
    QUEUE_CRON_SECRET: 'queue',
    TRACEWORKS_STORAGE_DRIVER: 'kv',
    UPSTASH_REDIS_REST_URL: 'https://kv.example.com',
    UPSTASH_REDIS_REST_TOKEN: 'kv-secret',
    APPRAISAL_API_URL: 'https://sources.example/appraisal',
    TAX_COLLECTOR_API_URL: 'https://sources.example/tax',
    PARCEL_GIS_API_URL: 'https://sources.example/gis',
    COUNTY_CLERK_API_URL: 'https://sources.example/clerk',
    GRANTOR_GRANTEE_API_URL: 'https://sources.example/grantor',
    MORTGAGE_INDEX_API_URL: 'https://sources.example/mortgage',
    OBITUARY_API_URL: 'https://sources.example/obits',
    PROBATE_API_URL: 'https://sources.example/probate',
    PEOPLE_ASSOC_API_URL: 'https://sources.example/people',
    PEOPLE_ASSOC_LICENSED: 'true'
  });

  assert.ok(result.checks.some((check) => check.id === 'bundled_source_catalog' && check.status === 'warn'));
});

test('launch audit passes premium OSINT checks when Firecrawl is configured', () => {
  const result = auditLaunchReadiness({
    URL: 'https://traceworks.app',
    STRIPE_SECRET_KEY: 'sk_live_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_123',
    SMTP_HOST: 'smtp-mail.outlook.com',
    SMTP_USER: 'traceworks@example.com',
    SMTP_PASS: 'secret',
    EMAIL_FROM: 'TraceWorks <ops@example.com>',
    OWNER_EMAIL: 'ops@example.com',
    ADMIN_API_KEY: 'admin',
    STATUS_TOKEN_SECRET: 'status',
    QUEUE_CRON_SECRET: 'queue',
    TRACEWORKS_STORAGE_DRIVER: 'kv',
    UPSTASH_REDIS_REST_URL: 'https://kv.example.com',
    UPSTASH_REDIS_REST_TOKEN: 'kv-secret',
    APPRAISAL_API_URL: 'https://sources.example/appraisal',
    TAX_COLLECTOR_API_URL: 'https://sources.example/tax',
    PARCEL_GIS_API_URL: 'https://sources.example/gis',
    COUNTY_CLERK_API_URL: 'https://sources.example/clerk',
    GRANTOR_GRANTEE_API_URL: 'https://sources.example/grantor',
    MORTGAGE_INDEX_API_URL: 'https://sources.example/mortgage',
    OBITUARY_API_URL: 'https://sources.example/obits',
    PROBATE_API_URL: 'https://sources.example/probate',
    PEOPLE_ASSOC_API_URL: 'https://sources.example/people',
    PEOPLE_ASSOC_LICENSED: 'true',
    FIRECRAWL_API_KEY: 'firecrawl-secret',
    PUBLIC_RECORD_SOURCE_CONFIG: JSON.stringify({
      countyProperty: [{ id: 'property', type: 'html' }],
      countyRecorder: [{ id: 'recorder', type: 'html' }],
      probateIndex: [{ id: 'probate', type: 'html' }],
      entitySearch: [{ id: 'entity', type: 'json' }]
    })
  });

  assert.ok(result.checks.some((check) => check.id === 'premium_osint' && check.status === 'pass'));
});

test('package launch gate blocks only packages whose source coverage is missing', () => {
  const env = {
    URL: 'https://traceworks.app',
    STRIPE_SECRET_KEY: 'sk_live_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_123',
    SMTP_HOST: 'smtp-mail.outlook.com',
    SMTP_USER: 'traceworks@example.com',
    SMTP_PASS: 'secret',
    STATUS_TOKEN_SECRET: 'status',
    QUEUE_CRON_SECRET: 'queue',
    TRACEWORKS_STORAGE_DRIVER: 'kv',
    UPSTASH_REDIS_REST_URL: 'https://kv.example.com',
    UPSTASH_REDIS_REST_TOKEN: 'kv-secret',
    APPRAISAL_API_URL: 'https://sources.example/appraisal',
    TAX_COLLECTOR_API_URL: 'https://sources.example/tax',
    PARCEL_GIS_API_URL: 'https://sources.example/gis',
    COUNTY_CLERK_API_URL: 'https://sources.example/clerk',
    GRANTOR_GRANTEE_API_URL: 'https://sources.example/grantor',
    MORTGAGE_INDEX_API_URL: 'https://sources.example/mortgage',
    PUBLIC_RECORD_SOURCE_CONFIG: JSON.stringify({
      countyProperty: [{ id: 'property', type: 'html' }],
      countyRecorder: [{ id: 'recorder', type: 'html' }],
      probateIndex: [{ id: 'probate', type: 'html' }],
      entitySearch: [{ id: 'entity', type: 'json' }]
    })
  };

  const standard = assessPackageLaunchGate('standard', env);
  const probate = assessPackageLaunchGate('probate_heirship', env);

  assert.equal(standard.launchReady, true);
  assert.equal(probate.launchReady, false);
  assert.ok(probate.launchBlockingAreas.includes('sources'));
  assert.ok(probate.launchBlockingDetails.some((detail) => detail.id === 'OBITUARY_API_URL'));
});
