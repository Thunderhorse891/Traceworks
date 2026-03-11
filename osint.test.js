import test from 'node:test';
import assert from 'node:assert/strict';
import { createStatusToken, verifyStatusToken } from '../netlify/functions/_lib/status-token.js';

test('status token roundtrip verifies caseRef/email', () => {
  process.env.STATUS_TOKEN_SECRET = 'test-secret-123';
  const token = createStatusToken({ caseRef: 'TW-ABC', email: 'USER@EXAMPLE.COM' }, 10_000);
  assert.ok(token);

  const out = verifyStatusToken(token);
  assert.equal(out.ok, true);
  assert.equal(out.caseRef, 'TW-ABC');
  assert.equal(out.email, 'user@example.com');
});

test('status token fails when tampered', () => {
  process.env.STATUS_TOKEN_SECRET = 'test-secret-123';
  const token = createStatusToken({ caseRef: 'TW-ABC', email: 'user@example.com' }, 10_000);
  const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
  const out = verifyStatusToken(tampered);
  assert.equal(out.ok, false);
});
