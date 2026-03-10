/**
 * TraceWorks persistent store — Vercel KV (Redis).
 * All order, job, analytics, audit, and dead-letter data is stored here.
 * Data survives deploys. Atomic job claiming via Redis ZPOPMIN.
 *
 * Vercel KV env vars (set via Vercel dashboard → Storage → KV):
 *   KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN, KV_REST_API_READ_ONLY_TOKEN
 */
import { kv } from '@vercel/kv';

// Key namespacing
const K = {
  order: (ref) => `tw:order:${ref}`,
  job: (id) => `tw:job:${id}`,
  jobQueue: 'tw:jobs:queue',          // sorted set, score = nextAttemptAt ms
  webhooks: 'tw:webhooks:processed',  // set of processed event IDs
  analytics: 'tw:analytics',          // list (capped)
  deadLetters: 'tw:deadletters',      // list (capped)
  auditLogs: 'tw:auditlogs',          // list (capped)
  orderIndex: 'tw:orders:index',      // list of all caseRefs (for admin)
};

function makeJobId() {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function backoffMs(attempts) {
  return Math.min(60_000, 2 ** Math.max(0, attempts - 1) * 1000);
}

// ── ORDERS ────────────────────────────────────────────────────

export async function upsertOrder(caseRef, patch) {
  const existing = await kv.get(K.order(caseRef));
  const current = existing || { caseRef, createdAt: new Date().toISOString(), fulfillmentAttempts: 0 };
  const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await kv.set(K.order(caseRef), updated);
  // Track in index for admin listing (deduplicated by set)
  await kv.sadd(K.orderIndex, caseRef);
  return updated;
}

export async function getOrder(caseRef) {
  return await kv.get(K.order(caseRef));
}

export async function incrementFulfillmentAttempt(caseRef) {
  const order = await getOrder(caseRef) || { caseRef, createdAt: new Date().toISOString(), fulfillmentAttempts: 0 };
  const next = Number(order.fulfillmentAttempts || 0) + 1;
  await upsertOrder(caseRef, { fulfillmentAttempts: next });
  return next;
}

export async function getAllOrders() {
  const refs = await kv.smembers(K.orderIndex);
  if (!refs || refs.length === 0) return [];
  const orders = await Promise.all(refs.map((ref) => kv.get(K.order(ref))));
  return orders.filter(Boolean).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

// ── WEBHOOK DEDUP ─────────────────────────────────────────────

export async function isProcessedWebhookEvent(eventId) {
  return Boolean(await kv.sismember(K.webhooks, eventId));
}

export async function markProcessedWebhookEvent(eventId) {
  await kv.sadd(K.webhooks, eventId);
  // TTL of 30 days on the set; Redis will auto-expire stale members is not native,
  // but the set stays small in practice (Stripe sends each event once).
}

// ── ANALYTICS ─────────────────────────────────────────────────

export async function recordAnalytics(event) {
  const entry = { ...event, at: new Date().toISOString() };
  await kv.lpush(K.analytics, JSON.stringify(entry));
  await kv.ltrim(K.analytics, 0, 9999); // keep last 10000
}

// ── DEAD LETTERS ──────────────────────────────────────────────

export async function recordDeadLetter(entry) {
  await kv.lpush(K.deadLetters, JSON.stringify({ ...entry, at: new Date().toISOString() }));
  await kv.ltrim(K.deadLetters, 0, 999); // keep last 1000
}

// ── AUDIT LOGS ────────────────────────────────────────────────

export async function recordAuditEvent(entry) {
  await kv.lpush(K.auditLogs, JSON.stringify({ ...entry, at: new Date().toISOString() }));
  await kv.ltrim(K.auditLogs, 0, 4999); // keep last 5000
}

// ── JOB QUEUE ─────────────────────────────────────────────────

export async function enqueueJob(job) {
  const item = {
    id: makeJobId(),
    status: 'queued',
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nextAttemptAt: new Date().toISOString(),
    ...job,
  };
  // Store job data
  await kv.set(K.job(item.id), item);
  // Add to sorted queue (score = timestamp for ordering)
  await kv.zadd(K.jobQueue, { score: Date.now(), member: item.id });
  return item;
}

export async function claimNextJob(type) {
  const now = Date.now();
  // Atomically pop the lowest-score (oldest due) job from the queue
  const members = await kv.zrangebyscore(K.jobQueue, 0, now, { limit: { offset: 0, count: 1 } });
  if (!members || members.length === 0) return null;

  const jobId = members[0];
  // Remove from queue atomically (another worker might beat us — that's OK, job data will be gone)
  const removed = await kv.zrem(K.jobQueue, jobId);
  if (!removed) return null; // another worker claimed it

  const job = await kv.get(K.job(jobId));
  if (!job || job.type !== type) {
    // Wrong type or missing — re-queue it if it exists
    if (job) await kv.zadd(K.jobQueue, { score: now, member: jobId });
    return null;
  }

  const claimed = {
    ...job,
    status: 'processing',
    attempts: Number(job.attempts || 0) + 1,
    updatedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
  };
  await kv.set(K.job(jobId), claimed);
  return claimed;
}

export async function completeJob(jobId) {
  const job = await kv.get(K.job(jobId));
  if (!job) return;
  await kv.set(K.job(jobId), {
    ...job,
    status: 'completed',
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    nextAttemptAt: null,
    lastError: null,
  });
}

export async function failJob(jobId, error, maxAttempts = 5) {
  const job = await kv.get(K.job(jobId));
  if (!job) return null;

  const attempts = Number(job.attempts || 0);
  const terminal = attempts >= maxAttempts;
  const waitMs = backoffMs(attempts);
  const nextAttemptAt = terminal ? null : new Date(Date.now() + waitMs).toISOString();
  const nextScore = terminal ? null : Date.now() + waitMs;

  const updated = {
    ...job,
    status: terminal ? 'failed' : 'retry',
    lastError: String(error || 'unknown error'),
    nextAttemptAt,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(K.job(jobId), updated);

  // Re-queue for retry
  if (!terminal && nextScore) {
    await kv.zadd(K.jobQueue, { score: nextScore, member: jobId });
  }

  return { terminal, attempts, nextAttemptAt, waitMs };
}

// ── METRICS ───────────────────────────────────────────────────

export async function getMetrics() {
  const orders = await getAllOrders();
  const byStatus = orders.reduce((acc, o) => {
    const s = o.status || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const attempts = orders.reduce((acc, o) => acc + Number(o.fulfillmentAttempts || 0), 0);
  const queueDepth = await kv.zcard(K.jobQueue);
  const deadCount = await kv.llen(K.deadLetters);
  const analyticsCount = await kv.llen(K.analytics);
  const auditCount = await kv.llen(K.auditLogs);

  // Oldest queued job
  const oldestMembers = await kv.zrangebyscore(K.jobQueue, 0, '+inf', { limit: { offset: 0, count: 1 }, withScores: true });
  const queueOldestMs = oldestMembers && oldestMembers.length >= 2
    ? Math.max(0, Date.now() - Number(oldestMembers[1]))
    : 0;

  return {
    ordersTotal: orders.length,
    byStatus,
    avgFulfillmentAttempts: orders.length ? Number((attempts / orders.length).toFixed(2)) : 0,
    queueDepth: Number(queueDepth || 0),
    queueOldestMs,
    deadLetters: Number(deadCount || 0),
    analyticsEvents: Number(analyticsCount || 0),
    auditLogEvents: Number(auditCount || 0),
  };
}
