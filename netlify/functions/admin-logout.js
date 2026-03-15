import { buildAdminSessionCookie } from './_lib/admin-session.js';
import { jsonWithRequestId } from './_lib/http.js';

export default async (event) => {
  if (event.httpMethod !== 'POST') return jsonWithRequestId(event, 405, { error: 'Method not allowed' });

  return jsonWithRequestId(event, 200, { ok: true }, {
    'set-cookie': buildAdminSessionCookie('', event, { clear: true })
  });
};
