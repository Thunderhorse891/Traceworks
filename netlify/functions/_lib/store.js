import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getKvClient, usesKvStorage, withKvLock } from './storage-runtime.js';

const EMPTY = { orders: {}, processedWebhookEvents: [], analytics: [], deadLetters: [], jobs: [], auditLogs: [] };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function storePath() {
  return process.env.TRACEWORKS_STORE_PATH || '.data/traceworks-store.json';
}

function storeKey() {
  return process.env.TRACEWORKS_STORE_KEY || 'traceworks:store:v1';
}

function storeLockKey() {
  return `${storeKey()}:lock`;
}

function normalizeStore(raw) {
  if (!raw) return { ...EMPTY };
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return { ...EMPTY, ...parsed };
}

async function loadStore(kv = null) {
  if (usesKvStorage()) {
    const client = kv || (await getKvClient());
    const raw = await client.get(storeKey());
    return normalizeStore(raw);
  }

  try {
    const raw = await readFile(storePath(), 'utf8');
    return normalizeStore(raw);
  } catch {
    return { ...EMPTY };
  }
}

async function saveStore(store, kv = null) {
  if (usesKvStorage()) {
    const client = kv || (await getKvClient());
    await client.set(storeKey(), JSON.stringify(store));
    return;
  }

  await mkdir(dirname(storePath()), { recursive: true });
  const tmp = `${storePath()}.${process.pid}.${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.tmp`;
  await writeFile(tmp, JSON.stringify(store, null, 2));

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await rename(tmp, storePath());
      return;
    } catch (error) {
      const retryable = ['EPERM', 'EACCES'].includes(error?.code || '');
      if (!retryable || attempt === 3) throw error;
      await sleep(25 * (attempt + 1));
    }
  }
}

async function mutateStore(mutator) {
  if (usesKvStorage()) {
    return withKvLock(storeLockKey(), async (kv) => {
      const store = await loadStore(kv);
      const result = await mutator(store);
      await saveStore(store, kv);
      return result;
    });
  }

  const store = await loadStore();
  const result = await mutator(store);
  await saveStore(store);
  return result;
}

function makeJobId() {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function backoffMs(attempts) {
  return Math.min(60_000, 2 ** Math.max(0, attempts - 1) * 1000);
}

export async function upsertOrder(caseRef, patch) {
  return mutateStore(async (store) => {
    const current = store.orders[caseRef] || { caseRef, createdAt: new Date().toISOString(), fulfillmentAttempts: 0 };
    store.orders[caseRef] = { ...current, ...patch, updatedAt: new Date().toISOString() };
    return store.orders[caseRef];
  });
}

export async function incrementFulfillmentAttempt(caseRef) {
  return mutateStore(async (store) => {
    const order = store.orders[caseRef] || { caseRef, createdAt: new Date().toISOString(), fulfillmentAttempts: 0 };
    const next = Number(order.fulfillmentAttempts || 0) + 1;
    store.orders[caseRef] = { ...order, fulfillmentAttempts: next, updatedAt: new Date().toISOString() };
    return next;
  });
}

export async function getOrder(caseRef) {
  const store = await loadStore();
  return store.orders[caseRef] || null;
}

export async function listOrders(limit = 200) {
  const store = await loadStore();
  return Object.values(store.orders)
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0))
    .slice(0, Math.max(1, Math.min(1000, Number(limit) || 200)));
}

export async function isProcessedWebhookEvent(eventId) {
  const store = await loadStore();
  return store.processedWebhookEvents.includes(eventId);
}

export async function markProcessedWebhookEvent(eventId) {
  await mutateStore(async (store) => {
    if (!store.processedWebhookEvents.includes(eventId)) {
      store.processedWebhookEvents.push(eventId);
      if (store.processedWebhookEvents.length > 5000) {
        store.processedWebhookEvents = store.processedWebhookEvents.slice(-5000);
      }
    }
  });
}

export async function recordAnalytics(event) {
  await mutateStore(async (store) => {
    store.analytics.push({ ...event, at: new Date().toISOString() });
    if (store.analytics.length > 10000) store.analytics = store.analytics.slice(-10000);
  });
}

export async function recordDeadLetter(entry) {
  await mutateStore(async (store) => {
    store.deadLetters.push({ ...entry, at: new Date().toISOString() });
    if (store.deadLetters.length > 1000) store.deadLetters = store.deadLetters.slice(-1000);
  });
}

export async function recordAuditEvent(entry) {
  await mutateStore(async (store) => {
    store.auditLogs.push({ ...entry, at: new Date().toISOString() });
    if (store.auditLogs.length > 5000) store.auditLogs = store.auditLogs.slice(-5000);
  });
}

export async function enqueueJob(job) {
  return mutateStore(async (store) => {
    const item = {
      id: makeJobId(),
      status: 'queued',
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextAttemptAt: new Date().toISOString(),
      ...job
    };
    store.jobs.push(item);
    if (store.jobs.length > 20000) store.jobs = store.jobs.slice(-20000);
    return item;
  });
}

export async function claimNextJob(type) {
  return mutateStore(async (store) => {
    const nowMs = Date.now();
    const idx = store.jobs.findIndex((j) => {
      if (j.type !== type) return false;
      if (!(j.status === 'queued' || j.status === 'retry')) return false;
      const dueMs = j.nextAttemptAt ? Date.parse(j.nextAttemptAt) : 0;
      return Number.isNaN(dueMs) || dueMs <= nowMs;
    });
    if (idx === -1) return null;

    const now = new Date().toISOString();
    const job = store.jobs[idx];
    const claimed = { ...job, status: 'processing', attempts: Number(job.attempts || 0) + 1, updatedAt: now, startedAt: now };
    store.jobs[idx] = claimed;
    return claimed;
  });
}

export async function claimJobByCaseRef(type, caseRef) {
  if (!caseRef) return null;

  return mutateStore(async (store) => {
    const nowMs = Date.now();
    const idx = store.jobs.findIndex((j) => {
      if (j.type !== type) return false;
      if (j.payload?.caseRef !== caseRef) return false;
      if (!(j.status === 'queued' || j.status === 'retry')) return false;
      const dueMs = j.nextAttemptAt ? Date.parse(j.nextAttemptAt) : 0;
      return Number.isNaN(dueMs) || dueMs <= nowMs;
    });

    if (idx === -1) return null;

    const now = new Date().toISOString();
    const job = store.jobs[idx];
    const claimed = { ...job, status: 'processing', attempts: Number(job.attempts || 0) + 1, updatedAt: now, startedAt: now };
    store.jobs[idx] = claimed;
    return claimed;
  });
}

export async function completeJob(jobId) {
  await mutateStore(async (store) => {
    const idx = store.jobs.findIndex((j) => j.id === jobId);
    if (idx !== -1) {
      store.jobs[idx] = {
        ...store.jobs[idx],
        status: 'completed',
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        nextAttemptAt: null,
        lastError: null
      };
    }
  });
}

export async function failJob(jobId, error, maxAttempts = 5) {
  return mutateStore(async (store) => {
    const idx = store.jobs.findIndex((j) => j.id === jobId);
    if (idx === -1) return null;

    const j = store.jobs[idx];
    const attempts = Number(j.attempts || 0);
    const terminal = attempts >= maxAttempts;
    const waitMs = backoffMs(attempts);
    const nextAttemptAt = terminal ? null : new Date(Date.now() + waitMs).toISOString();

    store.jobs[idx] = {
      ...j,
      status: terminal ? 'failed' : 'retry',
      lastError: String(error || 'unknown error'),
      nextAttemptAt,
      updatedAt: new Date().toISOString()
    };
    return { terminal, attempts, nextAttemptAt, waitMs };
  });
}

export async function getMetrics() {
  const store = await loadStore();
  const orders = Object.values(store.orders);
  const byStatus = orders.reduce((acc, o) => {
    acc[o.status || 'unknown'] = (acc[o.status || 'unknown'] || 0) + 1;
    return acc;
  }, {});

  const attempts = orders.reduce((acc, o) => acc + Number(o.fulfillmentAttempts || 0), 0);
  const jobsByStatus = store.jobs.reduce((acc, j) => {
    acc[j.status || 'unknown'] = (acc[j.status || 'unknown'] || 0) + 1;
    return acc;
  }, {});

  const actionableJobs = store.jobs.filter((j) => j.status === 'queued' || j.status === 'retry');
  const oldestQueueMs = actionableJobs.length
    ? Date.now() - Math.min(...actionableJobs.map((j) => Date.parse(j.createdAt || j.updatedAt || new Date().toISOString())))
    : 0;

  return {
    ordersTotal: orders.length,
    byStatus,
    processedWebhookEvents: store.processedWebhookEvents.length,
    analyticsEvents: store.analytics.length,
    deadLetters: store.deadLetters.length,
    auditLogEvents: store.auditLogs.length,
    avgFulfillmentAttempts: orders.length ? Number((attempts / orders.length).toFixed(2)) : 0,
    queueDepth: actionableJobs.length,
    queueOldestMs: Math.max(0, oldestQueueMs),
    jobsByStatus
  };
}

export async function getOperationsSnapshot(limit = 12) {
  const store = await loadStore();
  const max = Math.max(1, Math.min(100, Number(limit) || 12));
  const orders = Object.values(store.orders);

  const recentAuditEvents = [...store.auditLogs]
    .sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0))
    .slice(0, max);

  const recentDeadLetters = [...store.deadLetters]
    .sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0))
    .slice(0, max);

  const activeJobs = [...store.jobs]
    .filter((job) => ['queued', 'retry', 'processing'].includes(job.status))
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0))
    .slice(0, max);

  const manualReviewOrders = [...orders]
    .filter((order) => order.status === 'manual_review')
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0))
    .slice(0, max);

  return {
    recentAuditEvents,
    recentDeadLetters,
    activeJobs,
    manualReviewOrders
  };
}
