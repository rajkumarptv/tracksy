// Helpers for the OAuth sign-in flow, kept free of passport/db so they can be unit-tested.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/** A short-lived signed value sent to Google as `state` and checked on return (stops login CSRF). */
function signState() {
  return jwt.sign({ purpose: 'oauth-state', n: crypto.randomBytes(8).toString('hex') }, process.env.JWT_SECRET, { expiresIn: '10m' });
}

function verifyState(state) {
  if (typeof state !== 'string' || !state) return false;
  try { return jwt.verify(state, process.env.JWT_SECRET).purpose === 'oauth-state'; } catch { return false; }
}

/** Google marks whether the address was confirmed; never trust an unverified one for linking accounts. */
function googleEmail(profile) {
  const e = profile?.emails?.[0];
  const verified = e?.verified === true || e?.verified === 'true' || profile?._json?.email_verified === true || profile?._json?.email_verified === 'true';
  return e?.value && verified ? String(e.value).toLowerCase() : null;
}

module.exports = { signState, verifyState, googleEmail };
