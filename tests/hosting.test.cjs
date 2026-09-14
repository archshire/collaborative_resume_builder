const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDemoAccess, createFixedWindowLimiter } = require('../server/hosting.cjs');

const request = (cookie = '', remoteAddress = '203.0.113.10') => ({ headers: { cookie }, socket: { remoteAddress } });

test('hosted demo access uses a private HttpOnly secure session cookie', () => {
  const access = createDemoAccess('correct horse battery staple', { secure: true, sessionHours: 2 });
  assert.equal(access.required, true);
  assert.equal(access.authenticated(request()), false);
  assert.equal(access.login('wrong'), '');
  const setCookie = access.login('correct horse battery staple');
  assert.match(setCookie, /^crb_demo_session=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /Max-Age=7200/);
  assert.equal(access.authenticated(request(setCookie.split(';')[0])), true);
  assert.match(access.logoutCookie(), /Max-Age=0/);
});

test('local mode requires no outer password', () => {
  const access = createDemoAccess('');
  assert.equal(access.required, false);
  assert.equal(access.authenticated(request()), true);
});

test('fixed-window limiter blocks excess AI requests and resets', () => {
  const consume = createFixedWindowLimiter({ limit: 2, windowMs: 1000 });
  assert.deepEqual(consume('session', 100), { allowed: true, remaining: 1 });
  assert.deepEqual(consume('session', 200), { allowed: true, remaining: 0 });
  assert.deepEqual(consume('session', 300), { allowed: false, retryAfter: 1 });
  assert.deepEqual(consume('session', 1100), { allowed: true, remaining: 1 });
});
