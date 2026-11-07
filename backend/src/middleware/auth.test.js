const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'test-secret';
const jwt = require('jsonwebtoken');
const auth = require('./auth');

const run = (token) => new Promise((resolve) => {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = { status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
  auth(req, res, () => resolve({ next: true, user: req.user }));
});

test('a normal session token passes and exposes the user id', async () => {
  const r = await run(jwt.sign({ userId: 'u1', email: 'a@b.co' }, 'test-secret'));
  assert.equal(r.next, true);
  assert.equal(r.user.userId, 'u1');
});

test('a single-purpose bill link token is not accepted as a login', async () => {
  const r = await run(jwt.sign({ purpose: 'bill', bill: 'b1', userId: 'u1' }, 'test-secret'));
  assert.equal(r.code, 401);
});

test('missing, malformed, wrongly signed and userless tokens are rejected', async () => {
  assert.equal((await run(null)).code, 401);
  assert.equal((await run('not-a-jwt')).code, 401);
  assert.equal((await run(jwt.sign({ userId: 'u1' }, 'other-secret'))).code, 401);
  assert.equal((await run(jwt.sign({ email: 'x' }, 'test-secret'))).code, 401);
});
