const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'test-secret';
const jwt = require('jsonwebtoken');
const { signState, verifyState, googleEmail } = require('./oauthState');

test('a state we signed verifies; anything else does not', () => {
  assert.equal(verifyState(signState()), true);
  assert.equal(verifyState(undefined), false);
  assert.equal(verifyState('abc'), false);
  assert.equal(verifyState(jwt.sign({ purpose: 'oauth-state' }, 'other-secret')), false);       // wrong secret
  assert.equal(verifyState(jwt.sign({ userId: 'u1' }, 'test-secret')), false);                  // a login token is not a state
  assert.equal(verifyState(jwt.sign({ purpose: 'oauth-state' }, 'test-secret', { expiresIn: -5 })), false); // expired
});

test('googleEmail only returns verified, lower-cased addresses', () => {
  assert.equal(googleEmail({ emails: [{ value: 'A@Gmail.com', verified: true }] }), 'a@gmail.com');
  assert.equal(googleEmail({ emails: [{ value: 'a@gmail.com' }], _json: { email_verified: true } }), 'a@gmail.com');
  assert.equal(googleEmail({ emails: [{ value: 'a@gmail.com', verified: false }] }), null);
  assert.equal(googleEmail({ emails: [{ value: 'a@gmail.com' }] }), null);
  assert.equal(googleEmail({}), null);
});

test('the session auth middleware rejects an oauth state token', async () => {
  const auth = require('../middleware/auth');
  const res = await new Promise((resolve) => {
    const req = { headers: { authorization: `Bearer ${signState()}` } };
    auth(req, { status() { return this; }, json: (b) => resolve(b) }, () => resolve({ next: true }));
  });
  assert.notEqual(res.next, true);
});
