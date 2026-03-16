import { buildAdminSessionCookie } from './_lib/admin-session.js';
import { jsonWithRequestId } from './_lib/http.js';
import { createModernHandler } from './_lib/netlify-modern.js';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  return jsonWithRequestId(event, 200, { ok: true }, {
    'set-cookie': buildAdminSessionCookie('', event, { clear: true })
  });
}

export default createModernHandler(handler);
