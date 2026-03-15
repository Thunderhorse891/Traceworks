import test from 'node:test';
import assert from 'node:assert/strict';

function restoreEnv(snapshot, keys) {
  for (const key of keys) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

test('admin session token roundtrip verifies and is accepted by requireAdmin', async () => {
  const keys = ['ADMIN_API_KEY', 'ADMIN_SESSION_SECRET'];
  const snapshot = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.ADMIN_API_KEY = 'admin-secret';
  process.env.ADMIN_SESSION_SECRET = 'session-secret';

  try {
    const session = await import(`../netlify/functions/_lib/admin-session.js?ts=${Date.now()}`);
    const auth = await import(`../netlify/functions/_lib/admin-auth.js?ts=${Date.now()}`);

    const token = session.createAdminSessionToken({ ttlSeconds: 600 });
    const payload = session.verifyAdminSessionToken(token);
    assert.equal(payload.sub, 'traceworks_admin');

    const result = auth.requireAdmin({
      headers: {
        cookie: `${session.ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`
      }
    });

    assert.equal(result.ok, true);
    assert.equal(result.method, 'session');
  } finally {
    restoreEnv(snapshot, keys);
  }
});

test('admin-login returns an HttpOnly cookie when the API key is valid', async () => {
  const keys = ['ADMIN_API_KEY', 'ADMIN_SESSION_SECRET', 'URL'];
  const snapshot = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.ADMIN_API_KEY = 'admin-secret';
  process.env.ADMIN_SESSION_SECRET = 'session-secret';
  process.env.URL = 'https://traceworks.example.com';

  try {
    const { default: login } = await import(`../netlify/functions/admin-login.js?ts=${Date.now()}`);
    const response = await login({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ apiKey: 'admin-secret' })
    });

    assert.equal(response.statusCode, 200);
    assert.ok(response.headers['set-cookie'].includes('HttpOnly'));
    assert.ok(response.headers['set-cookie'].includes('SameSite=Strict'));
    assert.ok(response.headers['set-cookie'].includes('Secure'));
  } finally {
    restoreEnv(snapshot, keys);
  }
});

test('admin dashboard uses cookie login flow instead of sessionStorage bearer reuse', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync('public/admin-dashboard.html', 'utf8');
  assert.ok(html.includes('/api/admin-login'));
  assert.ok(html.includes("credentials: 'same-origin'"));
  assert.equal(html.includes('sessionStorage'), false);
});
