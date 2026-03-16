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
  assert.ok(secrets.ADMIN_SESSION_SECRET);
  assert.ok(secrets.STATUS_TOKEN_SECRET);
  assert.ok(secrets.QUEUE_CRON_SECRET);
  assert.notEqual(secrets.ADMIN_API_KEY, secrets.STATUS_TOKEN_SECRET);
  assert.notEqual(secrets.ADMIN_API_KEY, secrets.ADMIN_SESSION_SECRET);
});

test('buildNetlifyEnvTemplate prints required launch env names', () => {
  const template = buildNetlifyEnvTemplate({
    siteUrl: 'https://traceworks.example.com',
    ownerEmail: 'traceworks.tx@outlook.com',
    emailFrom: 'traceworks.tx@outlook.com',
    secrets: {
      ADMIN_API_KEY: 'admin-secret',
      ADMIN_SESSION_SECRET: 'admin-session-secret',
      STATUS_TOKEN_SECRET: 'status-secret',
      QUEUE_CRON_SECRET: 'queue-secret'
    }
  });

  assert.ok(template.includes('URL=https://traceworks.example.com'));
  assert.ok(template.includes('STRIPE_SECRET_KEY=<rotate-and-paste-live-secret>'));
  assert.ok(template.includes('TRACEWORKS_STORAGE_DRIVER=blobs'));
  assert.ok(template.includes('Netlify Blobs requires no extra credentials'));
  assert.ok(template.includes('ADMIN_API_KEY=admin-secret'));
  assert.ok(template.includes('ADMIN_SESSION_SECRET=admin-session-secret'));
  assert.ok(template.includes('PEOPLE_ASSOC_LICENSED=true'));
  assert.ok(template.includes('FIRECRAWL_API_KEY=<firecrawl-api-key>'));
  assert.ok(template.includes('APIFY_API_TOKEN=<apify-api-token>'));
});

test('formatSourceEndpointContracts documents source query expectations', () => {
  const lines = formatSourceEndpointContracts();
  assert.ok(lines.some((line) => line.includes('APPRAISAL_API_URL')));
  assert.ok(lines.some((line) => line.includes('COUNTY_CLERK_API_URL')));
  assert.ok(lines.some((line) => line.includes('PEOPLE_ASSOC_API_URL')));
});
