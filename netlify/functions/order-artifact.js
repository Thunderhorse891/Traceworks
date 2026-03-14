import { readArtifact } from './_lib/artifacts.js';
import { jsonWithRequestId } from './_lib/http.js';
import { hitRateLimit } from './_lib/rate-limit.js';
import { getOrder } from './_lib/store.js';
import { verifyStatusToken } from './_lib/status-token.js';

const INLINE_FORMATS = new Set(['html']);

const ARTIFACT_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': "default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};

function header(event, name) {
  return event?.headers?.[name] || event?.headers?.[name.toLowerCase()] || event?.headers?.[name.toUpperCase()] || '';
}

function authorizeAdmin(event, configuredKey) {
  const auth = header(event, 'authorization');
  return Boolean(configuredKey && auth === `Bearer ${configuredKey}`);
}

async function authorizeCustomer(order, params) {
  const statusToken = params.statusToken || params.status_token;
  const email = String(params.email || '').toLowerCase().trim();

  if (statusToken) {
    const verified = verifyStatusToken(statusToken);
    if (!verified.ok) return { ok: false, statusCode: 403, error: 'Invalid status token.' };
    if (verified.caseRef !== order.caseRef) {
      return { ok: false, statusCode: 403, error: 'Status token does not match this case.' };
    }
    if ((order.customerEmail || '').toLowerCase() !== verified.email) {
      return { ok: false, statusCode: 403, error: 'Status token does not match this case.' };
    }
    return { ok: true };
  }

  if (!email) {
    return { ok: false, statusCode: 400, error: 'statusToken or email is required.' };
  }

  if ((order.customerEmail || '').toLowerCase() !== email) {
    return { ok: false, statusCode: 403, error: 'Email does not match this case.' };
  }

  return { ok: true };
}

export default async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonWithRequestId(event, 405, { error: 'Method not allowed.' });
  }

  const ip = header(event, 'x-forwarded-for') || header(event, 'client-ip') || 'unknown';
  const limit = hitRateLimit({ key: `order-artifact:${ip}`, windowMs: 60_000, max: 60 });
  if (limit.limited) {
    return jsonWithRequestId(event, 429, { error: 'Too many requests. Try again shortly.' });
  }

  const params = event.queryStringParameters || {};
  const caseRef = String(params.caseRef || '').trim();
  const format = String(params.format || 'html').toLowerCase().trim();

  if (!caseRef) {
    return jsonWithRequestId(event, 400, { error: 'caseRef is required.' });
  }

  if (!['html', 'pdf', 'txt', 'json'].includes(format)) {
    return jsonWithRequestId(event, 400, { error: 'Unsupported artifact format.' });
  }

  const order = await getOrder(caseRef);
  if (!order) {
    return jsonWithRequestId(event, 404, { error: 'Order not found.' });
  }

  if (!order.artifact_url_or_path) {
    return jsonWithRequestId(event, 404, { error: 'Report artifact is not available yet.' });
  }

  const configuredAdminKey = process.env.ADMIN_API_KEY || '';
  const authHeader = header(event, 'authorization');
  const adminAllowed = authorizeAdmin(event, configuredAdminKey);
  if (authHeader && configuredAdminKey && !adminAllowed) {
    return jsonWithRequestId(event, 401, { error: 'Unauthorized' });
  }

  if (!adminAllowed) {
    const authorization = await authorizeCustomer(order, params);
    if (!authorization.ok) {
      return jsonWithRequestId(event, authorization.statusCode, { error: authorization.error });
    }
  }

  try {
    const artifact = await readArtifact(order.caseRef, format);
    const disposition = INLINE_FORMATS.has(format) ? 'inline' : 'attachment';

    return {
      statusCode: 200,
      headers: {
        ...ARTIFACT_HEADERS,
        'content-type': artifact.contentType,
        'content-disposition': `${disposition}; filename="${artifact.filename}"`
      },
      isBase64Encoded: artifact.isBase64Encoded,
      body: artifact.body
    };
  } catch (error) {
    return jsonWithRequestId(event, 404, { error: error?.message || 'Artifact not found.' });
  }
};
