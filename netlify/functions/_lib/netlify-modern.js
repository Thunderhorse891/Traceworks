function normalizeHeaders(headers) {
  const out = {};
  for (const [key, value] of headers.entries()) {
    out[String(key || '').toLowerCase()] = value;
  }
  return out;
}

function buildQueryMaps(url) {
  const single = {};
  const multi = {};

  for (const [key, value] of url.searchParams.entries()) {
    if (!(key in single)) single[key] = value;
    if (!Array.isArray(multi[key])) multi[key] = [];
    multi[key].push(value);
  }

  return {
    queryStringParameters: Object.keys(single).length ? single : {},
    multiValueQueryStringParameters: Object.keys(multi).length ? multi : {}
  };
}

async function toClassicEvent(request) {
  const url = new URL(request.url);
  const method = String(request.method || 'GET').toUpperCase();
  const body = ['GET', 'HEAD'].includes(method) ? '' : await request.text();
  const headers = normalizeHeaders(request.headers);
  const cookies = request.headers.get('cookie');
  const queryMaps = buildQueryMaps(url);

  return {
    httpMethod: method,
    headers,
    multiValueHeaders: {},
    queryStringParameters: queryMaps.queryStringParameters,
    multiValueQueryStringParameters: queryMaps.multiValueQueryStringParameters,
    rawUrl: request.url,
    path: url.pathname,
    body,
    isBase64Encoded: false,
    cookies: cookies ? cookies.split(';').map((item) => item.trim()).filter(Boolean) : []
  };
}

function appendHeader(headers, key, value) {
  if (Array.isArray(value)) {
    for (const item of value) appendHeader(headers, key, item);
    return;
  }
  headers.append(key, String(value));
}

function toResponsePayload(result) {
  if (result instanceof Response) return result;
  if (result === undefined || result === null) return new Response(null, { status: 204 });

  const status = Number(result.statusCode || result.status || 200);
  const headers = new Headers();

  for (const [key, value] of Object.entries(result.headers || {})) {
    appendHeader(headers, key, value);
  }

  for (const [key, value] of Object.entries(result.multiValueHeaders || {})) {
    appendHeader(headers, key, value);
  }

  let body = result.body ?? '';
  if (result.isBase64Encoded) {
    body = Buffer.from(String(body), 'base64');
  } else if (body !== null && typeof body !== 'string' && !(body instanceof Uint8Array)) {
    body = JSON.stringify(body);
  }

  if ([204, 205, 304].includes(status)) {
    body = null;
  }

  return new Response(body, { status, headers });
}

export function createModernHandler(classicHandler) {
  return async (input) => {
    const isRequestLike = input instanceof Request
      || (input && typeof input === 'object' && typeof input.url === 'string' && typeof input.method === 'string' && input.headers);

    if (!isRequestLike) {
      return classicHandler(input);
    }

    const event = await toClassicEvent(input);
    const result = await classicHandler(event);
    return toResponsePayload(result);
  };
}
