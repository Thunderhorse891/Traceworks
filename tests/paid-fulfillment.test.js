import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('processPaidOrder runs paid workflow, creates artifact, and records delivery', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tw-paid-'));
  process.env.TRACEWORKS_STORE_PATH = join(dir, 'store.json');
  process.env.REPORT_ARTIFACT_ROOT = join(dir, 'artifacts');
  process.env.PAID_FULFILLMENT_STRICT = 'false';

  const store = await import(`../netlify/functions/_lib/store.js?ts=${Date.now()}`);
  const { processPaidOrder } = await import(`../netlify/functions/_lib/fulfillment.js?ts=${Date.now()}`);

  const orderId = 'TW-E2E-1';
  await store.upsertOrder(orderId, {
    order_id: orderId,
    caseRef: orderId,
    status: 'queued',
    purchased_tier: 'STANDARD_REPORT',
    packageId: 'locate',
    packageName: 'Skip Trace & Locate',
    customerName: 'Law Office',
    customerEmail: 'client@example.com',
    subjectName: 'Jordan Mercer',
    website: 'https://example.org',
    goals: 'Locate for service'
  });

  let emailAttempted = false;
  const tierRunner = async () => ({
    query: 'Jordan Mercer',
    queryPlan: ['Jordan Mercer locate'],
    providerHealth: [{ provider: 'robin', ok: true, hitCount: 1, error: null }],
    providerNote: 'test provider note',
    coverage: { totalSources: 1, distinctDomains: 1, providersWithHits: 1 },
    sources: [
      {
        title: 'County record hit',
        url: 'https://county.example/record',
        sourceType: 'county-records',
        confidence: 'high',
        provider: 'robin',
        domain: 'county.example'
      }
    ]
  });

  await processPaidOrder(orderId, {
    ownerEmail: 'owner@example.com',
    deps: {
      tierRunner,
      sendReportEmails: async () => {
        emailAttempted = true;
      }
    }
  });

  const updated = await store.getOrder(orderId);
  assert.equal(updated.status, 'completed');
  assert.equal(updated.email_delivery_status, 'sent');
  assert.ok(updated.artifact_url_or_path);
  assert.equal(emailAttempted, true);
  await access(updated.artifact_url_or_path);

  const evidencePath = join(dir, 'artifacts', orderId, 'evidence.json');
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  assert.equal(Array.isArray(evidence.sources), true);
  assert.equal(evidence.sources[0].provider, 'robin');

  await rm(dir, { recursive: true, force: true });
});
