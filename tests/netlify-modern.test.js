import test from 'node:test';
import assert from 'node:assert/strict';

import { createModernHandler } from '../netlify/functions/_lib/netlify-modern.js';

test('createModernHandler maps a Request into the classic event shape', async () => {
  let receivedEvent = null;
  const handler = createModernHandler(async (event) => {
    receivedEvent = event;
    return {
      statusCode: 201,
      headers: { 'content-type': 'application/json', 'x-test': 'ok' },
      body: JSON.stringify({ ok: true })
    };
  });

  const response = await handler(new Request('https://traceworks.example/api/source-proof?county=Harris&state=TX', {
    method: 'POST',
    headers: {
      authorization: 'Bearer admin',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ subjectName: 'Jane Owner' })
  }));

  assert.equal(receivedEvent.httpMethod, 'POST');
  assert.equal(receivedEvent.headers.authorization, 'Bearer admin');
  assert.equal(receivedEvent.queryStringParameters.county, 'Harris');
  assert.equal(receivedEvent.queryStringParameters.state, 'TX');
  assert.equal(receivedEvent.body, JSON.stringify({ subjectName: 'Jane Owner' }));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('x-test'), 'ok');
  assert.deepEqual(await response.json(), { ok: true });
});

test('createModernHandler preserves multi-value headers and empty bodies', async () => {
  const handler = createModernHandler(async () => ({
    statusCode: 204,
    multiValueHeaders: {
      'set-cookie': ['a=1; Path=/', 'b=2; Path=/']
    },
    body: ''
  }));

  const response = await handler(new Request('https://traceworks.example/api/ping'));
  assert.equal(response.status, 204);
  assert.equal(response.headers.getSetCookie().length, 2);
});

test('launch-audit default export supports the modern Request runtime', async () => {
  const previousAdminKey = process.env.ADMIN_API_KEY;
  process.env.ADMIN_API_KEY = 'admin-secret';

  try {
    const handler = (await import(`../netlify/functions/launch-audit.js?ts=${Date.now()}`)).default;
    const response = await handler(new Request('https://traceworks.example/api/launch-audit', {
      headers: { authorization: 'Bearer admin-secret' }
    }));

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(typeof body.ok, 'boolean');
  } finally {
    if (previousAdminKey === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = previousAdminKey;
  }
});

test('intake-preflight default export supports the modern Request runtime', async () => {
  const handler = (await import(`../netlify/functions/intake-preflight.js?ts=${Date.now()}`)).default;
  const response = await handler(new Request('https://traceworks.example/api/intake-preflight', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      packageId: 'standard',
      subjectName: 'Jane Owner',
      county: 'Harris',
      state: 'TX'
    })
  }));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'launchReady'), true);
});
