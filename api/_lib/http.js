const BASE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=()'
};

export const SECURITY_HTML_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=()'
};

export function getRequestId(req) {
  const incoming = req?.headers?.['x-request-id'] || req?.headers?.['x-nf-request-id'];
  if (incoming) return String(incoming);
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function sendJson(res, statusCode, data, extraHeaders = {}) {
  const headers = { ...BASE_HEADERS, ...extraHeaders };
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  res.status(statusCode).json(data);
}

export function sendJsonWithRequestId(req, res, statusCode, data, extraHeaders = {}) {
  const requestId = getRequestId(req);
  sendJson(res, statusCode, { requestId, ...data }, { ...extraHeaders, 'x-request-id': requestId });
}
