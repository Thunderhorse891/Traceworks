import { ADMIN_SESSION_COOKIE, parseCookies, verifyAdminSessionToken } from './admin-session.js';
import { jsonWithRequestId } from './http.js';

export function requireAdmin(event) {
  const configuredKey = String(process.env.ADMIN_API_KEY || '').trim();
  const authHeader = event?.headers?.authorization || '';
  const cookies = parseCookies(event?.headers?.cookie || '');
  const sessionPayload = verifyAdminSessionToken(cookies[ADMIN_SESSION_COOKIE]);

  if (!configuredKey) {
    return {
      ok: false,
      response: jsonWithRequestId(event, 500, { error: 'ADMIN_API_KEY is not configured.' })
    };
  }

  if (authHeader === `Bearer ${configuredKey}`) {
    return { ok: true, method: 'bearer' };
  }

  if (sessionPayload) {
    return { ok: true, method: 'session', session: sessionPayload };
  }

  if (authHeader && authHeader !== `Bearer ${configuredKey}`) {
    return {
      ok: false,
      response: jsonWithRequestId(event, 401, { error: 'Unauthorized' })
    };
  }

  return {
    ok: false,
    response: jsonWithRequestId(event, 401, { error: 'Unauthorized' })
  };
}
