import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const STORE_PATH = process.env.TRACEWORKS_STORE_PATH || '.data/traceworks-store.json';
const EMPTY = { orders: {}, processedWebhookEvents: [], analytics: [], deadLetters: [], jobs: [], auditLogs: [] };

async function loadStore() {
  try {
    const raw = await readFile(STORE_PATH, 'utf8');
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY };
  }
}

async function saveStore(store) {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(store, null, 2));
  await rename(tmp, STORE_PATH);
}

function makeJobId() {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function backoffMs(attempts) {
  return Math.min(60_000, 2 ** Math.max(0, attempts - 1) * 1000);
}

export async function upsertOrder(caseRef, patch) {
  const store = await loadStore();
  const current = store.orders[caseRef] || { caseRef, createdAt: new Date().toISOString(), fulfillmentAttempts: 0 };
  store.orders[caseRef] = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await saveStore(store);
  return store.orders[caseRef];
}

export async function incrementFulfillmentAttempt(caseRef) {
  const order = (await getOrder(caseRef)) || { caseRef, createdAt: new Date().toISOString(), fulfillmentAttempts: 0 };
  const next = Number(order.fulfillmentAttempts || 0) + 1;
  await upsertOrder(caseRef, { fulfillmentAttempts: next });
  return next;
}

export async function getOrder(caseRef) {
  const store = await loadStore();
  return store.orders[caseRef] || null;
}

export async function isProcessedWebhookEvent(eventId) {
  const store = await loadStore();
  return store.processedWebhookEvents.includes(eventId);
}

export async function markProcessedWebhookEvent(eventId) {
  const store = await loadStore();
  if (!store.processedWebhookEvents.includes(eventId)) {
    store.processedWebhookEvents.push(eventId);
    if (store.processedWebhookEvents.length > 5000) {
      store.processedWebhookEvents = store.processedWebhookEvents.slice(-5000);
    }
    await saveStore(store);
  }
}

export async function recordAnalytics(event) {
  const store = await loadStore();
  store.analytics.push({ ...event, at: new Date().toISOString() });
  if (store.analytics.length > 10000) store.analytics = store.analytics.slice(-10000);
  await saveStore(store);
}

export async function recordDeadLetter(entry) {
  const store = await loadStore();
  store.deadLetters.push({ ...entry, at: new Date().toISOString() });
  if (store.deadLetters.length > 1000) store.deadLetters = store.deadLetters.slice(-1000);
  await saveStore(store);
}

export async function recordAuditEvent(entry) {
  const store = await loadStore();
  store.auditLogs.push({ ...entry, at: new Date().toISOString() });
  if (store.auditLogs.length > 5000) store.auditLogs = store.auditLogs.slice(-5000);
  await saveStore(store);
}

export async function enqueueJob(job) {
  const store = await loadStore();
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
  await saveStore(store);
  return item;
}

export async function claimNextJob(type) {
  const store = await loadStore();
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
  await saveStore(store);
  return claimed;
}

export async function completeJob(jobId) {
  const store = await loadStore();
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
    await saveStore(store);
  }
}

export async function failJob(jobId, error, maxAttempts = 5) {
  const store = await loadStore();
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
  await saveStore(store);
  return { terminal, attempts, nextAttemptAt, waitMs };
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
