import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function base64url(data) {
  return Buffer.from(data).toString('base64url');
}

function fromBase64url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function secret() {
  return process.env.STATUS_TOKEN_SECRET || '';
}

function sign(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createStatusToken({ caseRef, email }, ttlMs = DEFAULT_TTL_MS) {
  if (!secret()) return null;
  const body = {
    caseRef,
    email: String(email || '').toLowerCase().trim(),
    exp: Date.now() + ttlMs
  };
  const payload = base64url(JSON.stringify(body));
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifyStatusToken(token) {
  if (!token || !secret()) return { ok: false, error: 'missing_token_or_secret' };
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return { ok: false, error: 'invalid_token_format' };

  const expected = sign(payload);
  if (sig.length !== expected.length) return { ok: false, error: 'invalid_signature' };
  const validSig = timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!validSig) return { ok: false, error: 'invalid_signature' };

  let body;
  try {
    body = JSON.parse(fromBase64url(payload));
  } catch {
    return { ok: false, error: 'invalid_payload' };
  }

  if (!body?.caseRef || !body?.email || !body?.exp) return { ok: false, error: 'missing_claims' };
  if (Date.now() > Number(body.exp)) return { ok: false, error: 'expired' };
  return {
    ok: true,
    caseRef: String(body.caseRef),
    email: String(body.email).toLowerCase().trim(),
    exp: Number(body.exp)
  };
}
