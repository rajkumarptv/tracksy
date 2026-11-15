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

/**
 * Turns a user returned by Supabase Auth (GET /auth/v1/user) into our OAuth profile, or null when it is not
 * a Google sign-in with an address Google has confirmed.
 */
function profileFromSupabaseUser(u) {
  if (!u || typeof u !== 'object') return null;
  const identity = (u.identities || []).find(i => i.provider === 'google');
  if (!identity && u.app_metadata?.provider !== 'google') return null;
  if (!u.email || !u.email_confirmed_at) return null;            // Supabase only sets this once the email is confirmed
  const meta = { ...(identity?.identity_data || {}), ...(u.user_metadata || {}) };
  const full = String(meta.full_name || meta.name || '').trim();
  return {
    id: String(identity?.identity_data?.sub || identity?.id || u.id),
    email: String(u.email).toLowerCase(),
    firstName: meta.given_name || full.split(' ')[0] || '',
    lastName: meta.family_name || full.split(' ').slice(1).join(' ') || '',
    avatar: meta.avatar_url || meta.picture || null,
  };
}

module.exports = { signState, verifyState, googleEmail, profileFromSupabaseUser };
