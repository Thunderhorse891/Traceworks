import test from 'node:test';
import assert from 'node:assert/strict';

import { auditLaunchReadiness } from '../netlify/functions/_lib/launch-audit.js';

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
  assert.ok(result.checks.some((check) => check.id === 'browser_sources' && check.status === 'warn'));
});
