import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'traceworks_admin_session';
const DEFAULT_TTL_SECONDS = 12 * 60 * 60;

function trim(value) {
  return String(value || '').trim();
}

function sessionSecret() {
  return trim(process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_KEY || '');
}

function signToken(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', sessionSecret()).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifySignature(encodedPayload, signature) {
  const expected = createHmac('sha256', sessionSecret()).update(encodedPayload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function createAdminSessionToken({ ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
  if (!sessionSecret()) return null;
  const now = Math.floor(Date.now() / 1000);
  return signToken({
    sub: 'traceworks_admin',
    iat: now,
    exp: now + Math.max(60, Number(ttlSeconds) || DEFAULT_TTL_SECONDS)
  });
}

export function verifyAdminSessionToken(token) {
  const raw = trim(token);
  if (!raw || !sessionSecret()) return null;

  const [encodedPayload, signature] = raw.split('.');
  if (!encodedPayload || !signature) return null;
  if (!verifySignature(encodedPayload, signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (payload?.sub !== 'traceworks_admin') return null;
    const exp = Number(payload?.exp || 0);
    if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader = '') {
  return String(cookieHeader || '')
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const eq = pair.indexOf('=');
      if (eq === -1) return acc;
      const key = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (key) acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function secureCookieEnabled(event) {
  const forwardedProto = trim(event?.headers?.['x-forwarded-proto']).toLowerCase();
  if (forwardedProto) return forwardedProto === 'https';

  const baseUrl = trim(process.env.URL || process.env.SITE_URL || '');
  if (!baseUrl) return false;

  try {
    return new URL(baseUrl).protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildAdminSessionCookie(token, event, { ttlSeconds = DEFAULT_TTL_SECONDS, clear = false } = {}) {
  const parts = [
    `${ADMIN_SESSION_COOKIE}=${clear ? '' : encodeURIComponent(token || '')}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict'
  ];

  if (secureCookieEnabled(event)) parts.push('Secure');

  if (clear) {
    parts.push('Max-Age=0');
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  } else {
    parts.push(`Max-Age=${Math.max(60, Number(ttlSeconds) || DEFAULT_TTL_SECONDS)}`);
  }

  return parts.join('; ');
}
