// Small security helpers shared by controllers. Pure functions are unit-tested in security.test.js.
const crypto = require('crypto');

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;   // bcrypt only uses the first 72 bytes; this also bounds the hashing cost

/** Returns an error message, or null when the password is acceptable. */
function passwordProblem(pw) {
  if (typeof pw !== 'string') return 'Password is required';
  if (pw.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters`;
  if (pw.length > MAX_PASSWORD) return `Password must be at most ${MAX_PASSWORD} characters`;
  return null;
}

const isNonEmptyString = (v, max = 254) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/** Meta signs every webhook with HMAC-SHA256 of the raw body: header "sha256=<hex>". */
function verifyMetaSignature(rawBody, header, secret) {
  if (!secret || !header || !rawBody || typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const given = header.slice(7);
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
}

/** Uppercase code from an unambiguous alphabet, using a CSPRNG (Math.random is predictable). */
function randomCode(length = 6, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
}

const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

/** Only these upload types are accepted for bills, and only images/PDF are shown inline. */
const BILL_MIME_ALLOW = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'application/pdf'];

module.exports = { passwordProblem, isNonEmptyString, verifyMetaSignature, randomCode, hashToken, BILL_MIME_ALLOW, MIN_PASSWORD };
