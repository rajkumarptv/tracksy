const passport     = require('passport');
const GoogleStrategy   = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const jwt  = require('jsonwebtoken');
const { query } = require('../db');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
// Where OAuth callbacks land — the API's own public URL.
// Defaults to FRONTEND_URL for the single-domain (tunnel) setup.
const API_URL = process.env.API_URL || FRONTEND_URL;

// ── Shared: find-or-create user from OAuth profile ────────────────────────────
async function findOrCreate({ provider, id, email, firstName, lastName, avatar }) {
  // 1. Try by OAuth ID
  let result = await query(
    'SELECT id, first_name, last_name, email, is_premium FROM users WHERE oauth_provider=$1 AND oauth_id=$2',
    [provider, id]
  );
  if (result.rows.length) return result.rows[0];

  // 2. Try by email (link OAuth to existing account)
  if (email) {
    result = await query('SELECT id, first_name, last_name, email, is_premium FROM users WHERE email=$1', [email]);
    if (result.rows.length) {
      // Link the OAuth identity to the existing account
      await query(
        'UPDATE users SET oauth_provider=$1, oauth_id=$2, avatar_url=$3, updated_at=NOW() WHERE id=$4',
        [provider, id, avatar, result.rows[0].id]
      );
      return result.rows[0];
    }
  }

  // 3. Create new user
  const newUser = await query(`
    INSERT INTO users (first_name, last_name, email, oauth_provider, oauth_id, avatar_url)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, first_name, last_name, email, is_premium
  `, [firstName, lastName, email || null, provider, id, avatar || null]);

  // Create default notification prefs
  await query('INSERT INTO notification_preferences (user_id) VALUES ($1)', [newUser.rows[0].id]);

  return newUser.rows[0];
}

// ── Google Strategy ───────────────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  `${API_URL}/api/auth/google/callback`,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await findOrCreate({
        provider:  'google',
        id:        profile.id,
        email:     profile.emails?.[0]?.value,
        firstName: profile.name?.givenName  || profile.displayName?.split(' ')[0] || '',
        lastName:  profile.name?.familyName || profile.displayName?.split(' ')[1] || '',
        avatar:    profile.photos?.[0]?.value,
      });
      done(null, user);
    } catch (err) { done(err); }
  }));
}

// ── Facebook Strategy ─────────────────────────────────────────────────────────
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID:     process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL:  `${API_URL}/api/auth/facebook/callback`,
    profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await findOrCreate({
        provider:  'facebook',
        id:        profile.id,
        email:     profile.emails?.[0]?.value,
        firstName: profile.name?.givenName  || '',
        lastName:  profile.name?.familyName || '',
        avatar:    profile.photos?.[0]?.value,
      });
      done(null, user);
    } catch (err) { done(err); }
  }));
}

// ── Helper: issue JWT and redirect to frontend ────────────────────────────────
passport.issueTokenRedirect = (req, res) => {
  const user  = req.user;
  const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
};

module.exports = passport;
