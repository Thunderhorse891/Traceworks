import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNetlifyEnvTemplate,
  formatSourceEndpointContracts,
  generateLaunchSecrets
} from '../scripts/_lib/launch-kit.mjs';

test('generateLaunchSecrets returns all required runtime secrets', () => {
  const secrets = generateLaunchSecrets();
  assert.ok(secrets.ADMIN_API_KEY);
  assert.ok(secrets.STATUS_TOKEN_SECRET);
  assert.ok(secrets.QUEUE_CRON_SECRET);
  assert.notEqual(secrets.ADMIN_API_KEY, secrets.STATUS_TOKEN_SECRET);
});

test('buildNetlifyEnvTemplate prints required launch env names', () => {
  const template = buildNetlifyEnvTemplate({
    siteUrl: 'https://traceworks.example.com',
    ownerEmail: 'traceworks.tx@outlook.com',
    emailFrom: 'traceworks.tx@outlook.com',
    secrets: {
      ADMIN_API_KEY: 'admin-secret',
      STATUS_TOKEN_SECRET: 'status-secret',
      QUEUE_CRON_SECRET: 'queue-secret'
    }
  });

  assert.ok(template.includes('URL=https://traceworks.example.com'));
  assert.ok(template.includes('STRIPE_SECRET_KEY=<rotate-and-paste-live-secret>'));
  assert.ok(template.includes('TRACEWORKS_STORAGE_DRIVER=kv'));
  assert.ok(template.includes('ADMIN_API_KEY=admin-secret'));
  assert.ok(template.includes('PEOPLE_ASSOC_LICENSED=true'));
});

test('formatSourceEndpointContracts documents source query expectations', () => {
  const lines = formatSourceEndpointContracts();
  assert.ok(lines.some((line) => line.includes('APPRAISAL_API_URL')));
  assert.ok(lines.some((line) => line.includes('COUNTY_CLERK_API_URL')));
  assert.ok(lines.some((line) => line.includes('PEOPLE_ASSOC_API_URL')));
});
