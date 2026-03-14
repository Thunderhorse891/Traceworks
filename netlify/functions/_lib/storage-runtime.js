function configuredDriver(env = process.env) {
  const explicit = String(env.TRACEWORKS_STORAGE_DRIVER || '').trim().toLowerCase();
  if (explicit === 'file') return 'file';
  if (explicit === 'kv') return 'kv';

  const hasKvRestConfig = resolveKvRestConfig(env).configured;
  return hasKvRestConfig ? 'kv' : 'file';
}

let cachedKvClient = null;
let cachedKvSignature = '';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimEnv(value) {
  return String(value || '').trim();
}

export function resolveKvRestConfig(env = process.env) {
  const url = trimEnv(env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL);
  const token = trimEnv(env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN);
  return {
    url,
    token,
    configured: Boolean(url && token)
  };
}

export function missingKvConfigKeys(env = process.env) {
  const { url, token } = resolveKvRestConfig(env);
  const missing = [];
  if (!url) missing.push('UPSTASH_REDIS_REST_URL');
  if (!token) missing.push('UPSTASH_REDIS_REST_TOKEN');
  return missing;
}

function normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '');
}

function kvErrorMessage(env = process.env) {
  const missing = missingKvConfigKeys(env);
  if (!missing.length) return 'TraceWorks REST KV storage is not configured.';
  return `TRACEWORKS_STORAGE_DRIVER=kv requires ${missing.join(' and ')} (legacy KV_REST_API_URL / KV_REST_API_TOKEN aliases are also supported).`;
}

async function runKvPipeline(commands, env = process.env) {
  const { url, token } = resolveKvRestConfig(env);
  if (!url || !token) throw new Error(kvErrorMessage(env));

  const response = await fetch(`${normalizeBaseUrl(url)}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = Array.isArray(payload)
      ? payload.map((entry) => entry?.error).filter(Boolean).join('; ')
      : payload?.error;
    throw new Error(`TraceWorks REST KV request failed (${response.status}). ${detail || 'No error details returned.'}`);
  }

  if (!Array.isArray(payload)) {
    throw new Error('TraceWorks REST KV returned an invalid response payload.');
  }

  return payload.map((entry) => {
    if (entry?.error) {
      throw new Error(`TraceWorks REST KV error: ${entry.error}`);
    }
    return entry?.result ?? null;
  });
}

function createKvClient(env = process.env) {
  return {
    async get(key) {
      const [result] = await runKvPipeline([['GET', String(key)]], env);
      return result == null ? null : String(result);
    },
    async set(key, value, options = {}) {
      const command = ['SET', String(key), String(value)];
      const ttl = Number(options.ex ?? options.EX);
      if (Number.isFinite(ttl) && ttl > 0) {
        command.push('EX', String(Math.trunc(ttl)));
      }
      if (options.nx || options.NX) command.push('NX');
      if (options.xx || options.XX) command.push('XX');
      const [result] = await runKvPipeline([command], env);
      return result;
    },
    async del(key) {
      const [result] = await runKvPipeline([['DEL', String(key)]], env);
      return result;
    }
  };
}

export function storageDriverName(env = process.env) {
  return configuredDriver(env);
}

export function usesKvStorage(env = process.env) {
  return configuredDriver(env) === 'kv';
}

export async function getKvClient(env = process.env) {
  if (!usesKvStorage(env)) return null;

  const { url, token } = resolveKvRestConfig(env);
  if (!url || !token) {
    throw new Error(kvErrorMessage(env));
  }

  const signature = `${url}|${token}`;
  if (!cachedKvClient || cachedKvSignature !== signature) {
    cachedKvSignature = signature;
    cachedKvClient = createKvClient(env);
  }

  return cachedKvClient;
}

export async function withKvLock(
  lockKey,
  work,
  { ttlSeconds = 15, timeoutMs = 4000, pollMs = 80 } = {},
  env = process.env
) {
  const kv = await getKvClient(env);
  if (!kv) return work(null);

  const token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const acquired = await kv.set(lockKey, token, { nx: true, ex: ttlSeconds });
    if (acquired === 'OK' || acquired === true) {
      try {
        return await work(kv);
      } finally {
        try {
          const current = await kv.get(lockKey);
          if (current === token) await kv.del(lockKey);
        } catch {}
      }
    }

    await sleep(pollMs);
  }

  throw new Error(`Timed out acquiring TraceWorks KV lock: ${lockKey}`);
}

export function makeKvUri(key) {
  return `kv://${key}`;
}

export function parseKvUri(value) {
  const input = String(value || '');
  return input.startsWith('kv://') ? input.slice(5) : null;
}
