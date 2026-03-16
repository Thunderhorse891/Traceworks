import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeBlobModule() {
  const entries = new Map();
  let version = 0;

  function nextEtag() {
    version += 1;
    return `etag-${version}`;
  }

  function store() {
    return {
      async get(key, options = {}) {
        const entry = entries.get(String(key));
        if (!entry) return null;
        return options.type === 'json' ? JSON.parse(entry.value) : entry.value;
      },
      async getWithMetadata(key, options = {}) {
        const entry = entries.get(String(key));
        if (!entry) return null;
        return {
          data: options.type === 'json' ? JSON.parse(entry.value) : entry.value,
          etag: entry.etag,
          metadata: {}
        };
      },
      async set(key, value) {
        const etag = nextEtag();
        entries.set(String(key), { value: String(value), etag });
        return { etag, modified: true };
      },
      async setJSON(key, value, options = {}) {
        const current = entries.get(String(key));
        if (options.onlyIfNew && current) return { etag: current.etag, modified: false };
        if (options.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) {
          return { etag: current?.etag, modified: false };
        }
        const etag = nextEtag();
        entries.set(String(key), { value: JSON.stringify(value), etag });
        return { etag, modified: true };
      },
      async delete(key) {
        entries.delete(String(key));
      }
    };
  }

  return {
    getStore() {
      return store();
    }
  };
}

async function freshModules(tag) {
  const suffix = `${Date.now()}_${tag}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    store: await import(`../netlify/functions/_lib/store.js?ts=${suffix}`),
    artifacts: await import(`../netlify/functions/_lib/artifacts.js?ts=${suffix}`),
    tokens: await import(`../netlify/functions/_lib/status-token.js?ts=${suffix}`),
    handler: (await import(`../netlify/functions/order-artifact.js?ts=${suffix}`)).default
  };
}

function restoreEnv(values) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test('order-artifact serves customer report downloads with a valid status token', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'tw-artifact-'));
  const originalEnv = {
    TRACEWORKS_STORE_PATH: process.env.TRACEWORKS_STORE_PATH,
    REPORT_ARTIFACT_ROOT: process.env.REPORT_ARTIFACT_ROOT,
    STATUS_TOKEN_SECRET: process.env.STATUS_TOKEN_SECRET,
    ADMIN_API_KEY: process.env.ADMIN_API_KEY
  };

  t.after(async () => {
    restoreEnv(originalEnv);
    await rm(dir, { recursive: true, force: true });
  });

  process.env.TRACEWORKS_STORE_PATH = join(dir, 'store.json');
  process.env.REPORT_ARTIFACT_ROOT = join(dir, 'artifacts');
  process.env.STATUS_TOKEN_SECRET = 'traceworks-test-secret';
  process.env.ADMIN_API_KEY = 'admin-secret';

  const { store, artifacts, tokens, handler } = await freshModules('customer');
  const caseRef = 'TW-ARTIFACT-1';

  const saved = await artifacts.saveReportArtifacts({
    reportType: 'standard',
    orderId: caseRef,
    generatedAt: new Date().toISOString(),
    customerName: 'Client',
    customerEmail: 'client@example.com',
    purchasedTier: 'STANDARD_REPORT',
    customerInputs: { subjectName: 'Alex Harper' },
    overallStatus: 'complete',
    sections: [],
    sources: [],
    disclaimer: 'Test disclaimer'
  });

  await store.upsertOrder(caseRef, {
    order_id: caseRef,
    caseRef,
    customerEmail: 'client@example.com',
    status: 'completed',
    artifact_url_or_path: saved.htmlPath
  });

  const statusToken = tokens.createStatusToken({ caseRef, email: 'client@example.com' });
  assert.ok(statusToken);

  const response = await handler({
    httpMethod: 'GET',
    headers: { 'x-forwarded-for': '127.0.0.1' },
    queryStringParameters: {
      caseRef,
      format: 'pdf',
      status_token: statusToken
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-type'], 'application/pdf');
  assert.equal(response.isBase64Encoded, true);
  assert.equal(Buffer.from(response.body, 'base64').subarray(0, 4).toString('utf8'), '%PDF');
});

test('order-artifact rejects invalid admin bearer tokens', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'tw-artifact-auth-'));
  const originalEnv = {
    TRACEWORKS_STORE_PATH: process.env.TRACEWORKS_STORE_PATH,
    REPORT_ARTIFACT_ROOT: process.env.REPORT_ARTIFACT_ROOT,
    STATUS_TOKEN_SECRET: process.env.STATUS_TOKEN_SECRET,
    ADMIN_API_KEY: process.env.ADMIN_API_KEY
  };

  t.after(async () => {
    restoreEnv(originalEnv);
    await rm(dir, { recursive: true, force: true });
  });

  process.env.TRACEWORKS_STORE_PATH = join(dir, 'store.json');
  process.env.REPORT_ARTIFACT_ROOT = join(dir, 'artifacts');
  process.env.STATUS_TOKEN_SECRET = 'traceworks-test-secret';
  process.env.ADMIN_API_KEY = 'expected-admin-key';

  const { store, artifacts, handler } = await freshModules('admin');
  const caseRef = 'TW-ARTIFACT-2';

  const saved = await artifacts.saveReportArtifacts({
    reportType: 'standard',
    orderId: caseRef,
    generatedAt: new Date().toISOString(),
    customerName: 'Client',
    customerEmail: 'client@example.com',
    purchasedTier: 'STANDARD_REPORT',
    customerInputs: { subjectName: 'Morgan Lee' },
    overallStatus: 'complete',
    sections: [],
    sources: [],
    disclaimer: 'Test disclaimer'
  });

  await store.upsertOrder(caseRef, {
    order_id: caseRef,
    caseRef,
    customerEmail: 'client@example.com',
    status: 'completed',
    artifact_url_or_path: saved.htmlPath
  });

  const response = await handler({
    httpMethod: 'GET',
    headers: {
      authorization: 'Bearer wrong-key',
      'x-forwarded-for': '127.0.0.1'
    },
    queryStringParameters: {
      caseRef,
      format: 'html'
    }
  });

  assert.equal(response.statusCode, 401);
  const body = JSON.parse(response.body);
  assert.equal(body.error, 'Unauthorized');
});

test('artifacts default to the runtime temp directory in lambda-style runtimes', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'tw-artifact-runtime-'));
  const originalEnv = {
    REPORT_ARTIFACT_ROOT: process.env.REPORT_ARTIFACT_ROOT,
    AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
    TMPDIR: process.env.TMPDIR
  };

  t.after(async () => {
    restoreEnv(originalEnv);
    await rm(dir, { recursive: true, force: true });
  });

  delete process.env.REPORT_ARTIFACT_ROOT;
  process.env.AWS_LAMBDA_FUNCTION_NAME = 'traceworks-order-artifact';
  process.env.TMPDIR = dir;

  const { artifacts } = await freshModules('runtime');
  const saved = await artifacts.saveReportArtifacts({
    reportType: 'standard',
    orderId: 'TW-ARTIFACT-RUNTIME',
    generatedAt: new Date().toISOString(),
    customerName: 'Client',
    customerEmail: 'client@example.com',
    purchasedTier: 'STANDARD_REPORT',
    customerInputs: { subjectName: 'Skyler West' },
    overallStatus: 'complete',
    sections: [],
    sources: [],
    disclaimer: 'Test disclaimer'
  });

  assert.equal(saved.htmlPath.startsWith(join(dir, 'traceworks', 'reports')), true);
});

test('artifacts round-trip through the blobs storage driver', async (t) => {
  const originalEnv = {
    TRACEWORKS_STORAGE_DRIVER: process.env.TRACEWORKS_STORAGE_DRIVER,
    REPORT_ARTIFACT_ROOT: process.env.REPORT_ARTIFACT_ROOT
  };
  const previousModule = globalThis.__traceworksBlobsModule;

  t.after(() => {
    restoreEnv(originalEnv);
    if (previousModule === undefined) delete globalThis.__traceworksBlobsModule;
    else globalThis.__traceworksBlobsModule = previousModule;
  });

  process.env.TRACEWORKS_STORAGE_DRIVER = 'blobs';
  delete process.env.REPORT_ARTIFACT_ROOT;
  globalThis.__traceworksBlobsModule = makeBlobModule();

  const { artifacts } = await freshModules('blobs');
  const orderId = 'TW-ARTIFACT-BLOB';
  const saved = await artifacts.saveReportArtifacts({
    reportType: 'standard',
    orderId,
    generatedAt: new Date().toISOString(),
    customerName: 'Client',
    customerEmail: 'client@example.com',
    purchasedTier: 'STANDARD_REPORT',
    customerInputs: { subjectName: 'Alex Harper' },
    overallStatus: 'complete',
    sections: [],
    sources: [],
    disclaimer: 'Test disclaimer'
  });

  const pdf = await artifacts.readArtifact(orderId, 'pdf');
  assert.equal(saved.pdfPath.startsWith('blob://'), true);
  assert.equal(pdf.isBase64Encoded, true);
  assert.equal(Buffer.from(pdf.body, 'base64').subarray(0, 4).toString('utf8'), '%PDF');
});
