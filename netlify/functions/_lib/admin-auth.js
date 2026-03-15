import { jsonWithRequestId } from './http.js';

export function requireAdmin(event) {
  const configuredKey = String(process.env.ADMIN_API_KEY || '').trim();
  const authHeader = event?.headers?.authorization || '';

  if (!configuredKey) {
    return {
      ok: false,
      response: jsonWithRequestId(event, 500, { error: 'ADMIN_API_KEY is not configured.' })
    };
  }

  if (authHeader !== `Bearer ${configuredKey}`) {
    return {
      ok: false,
      response: jsonWithRequestId(event, 401, { error: 'Unauthorized' })
    };
  }

  return { ok: true, key: configuredKey };
}
