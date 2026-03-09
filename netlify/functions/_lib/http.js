const BASE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store'
};

export function getRequestId(event) {
  const incoming = event?.headers?.['x-request-id'] || event?.headers?.['x-nf-request-id'];
  if (incoming) return String(incoming);
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function json(statusCode, data, headers = {}) {
  return {
    statusCode,
    headers: { ...BASE_HEADERS, ...headers },
    body: JSON.stringify(data)
  };
}

export function jsonWithRequestId(event, statusCode, data, headers = {}) {
  const requestId = getRequestId(event);
  return json(statusCode, { requestId, ...data }, { ...headers, 'x-request-id': requestId });
}

export const SECURITY_HTML_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store'
};
