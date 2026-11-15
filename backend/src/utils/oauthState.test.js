const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'test-secret';
const jwt = require('jsonwebtoken');
const { signState, verifyState, googleEmail, profileFromSupabaseUser } = require('./oauthState');

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

test('profileFromSupabaseUser accepts only confirmed Google users and maps their details', () => {
  const ok = {
    id: 'sb-1', email: 'Ann.Lee@Gmail.com', email_confirmed_at: '2026-11-01T00:00:00Z',
    app_metadata: { provider: 'google' },
    identities: [{ provider: 'google', id: '123', identity_data: { sub: '123', full_name: 'Ann Marie Lee', avatar_url: 'https://x/y.png' } }],
    user_metadata: { full_name: 'Ann Marie Lee' },
  };
  assert.deepEqual(profileFromSupabaseUser(ok), { id: '123', email: 'ann.lee@gmail.com', firstName: 'Ann', lastName: 'Marie Lee', avatar: 'https://x/y.png' });
  assert.equal(profileFromSupabaseUser({ ...ok, email_confirmed_at: null }), null);                 // unconfirmed email
  assert.equal(profileFromSupabaseUser({ ...ok, email: '' }), null);
  assert.equal(profileFromSupabaseUser({ ...ok, identities: [{ provider: 'email' }], app_metadata: { provider: 'email' } }), null); // not Google
  assert.equal(profileFromSupabaseUser(null), null);
  assert.equal(profileFromSupabaseUser('x'), null);
});
