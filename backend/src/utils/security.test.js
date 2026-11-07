const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { passwordProblem, verifyMetaSignature, randomCode, hashToken, isNonEmptyString } = require('./security');

test('passwordProblem enforces length and type', () => {
  assert.match(passwordProblem('short'), /at least 8/);
  assert.match(passwordProblem(undefined), /required/);
  assert.match(passwordProblem({ $ne: '' }), /required/);
  assert.match(passwordProblem('x'.repeat(129)), /at most/);
  assert.equal(passwordProblem('long enough pw'), null);
});

test('verifyMetaSignature accepts only the correct HMAC of the raw body', () => {
  const body = Buffer.from('{"entry":[]}');
  const secret = 's3cret';
  const good = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyMetaSignature(body, good, secret), true);
  assert.equal(verifyMetaSignature(Buffer.from('{"entry":[1]}'), good, secret), false);   // tampered body
  assert.equal(verifyMetaSignature(body, good, 'other'), false);                          // wrong secret
  assert.equal(verifyMetaSignature(body, 'sha256=abc', secret), false);                   // wrong length
  assert.equal(verifyMetaSignature(body, undefined, secret), false);
  assert.equal(verifyMetaSignature(body, good, ''), false);                               // no secret configured
  assert.equal(verifyMetaSignature(undefined, good, secret), false);
});

test('randomCode uses the alphabet and requested length, and varies', () => {
  const codes = new Set(Array.from({ length: 50 }, () => randomCode(6)));
  assert.ok(codes.size > 45);
  for (const c of codes) assert.match(c, /^[A-HJ-NP-Z2-9]{6}$/);
});

test('hashToken is deterministic and not the token', () => {
  assert.equal(hashToken('abc'), hashToken('abc'));
  assert.notEqual(hashToken('abc'), 'abc');
  assert.match(hashToken('abc'), /^[0-9a-f]{64}$/);
});

test('isNonEmptyString rejects objects, blanks and oversize input', () => {
  assert.equal(isNonEmptyString('a@b.com'), true);
  assert.equal(isNonEmptyString({ $gt: '' }), false);
  assert.equal(isNonEmptyString('   '), false);
  assert.equal(isNonEmptyString('x'.repeat(300)), false);
});
