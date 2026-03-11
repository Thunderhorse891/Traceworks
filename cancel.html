const buckets = globalThis.__traceworksRateBuckets || new Map();
globalThis.__traceworksRateBuckets = buckets;

export function hitRateLimit({ key, windowMs, max }) {
  const now = Date.now();
  const record = buckets.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  record.count += 1;
  buckets.set(key, record);

  return {
    limited: record.count > max,
    remaining: Math.max(0, max - record.count),
    resetAt: record.resetAt
  };
}
