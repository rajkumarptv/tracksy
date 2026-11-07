// Per-IP (or per-user) request limits. State is in memory, so on serverless hosts each instance counts on
// its own: this stops casual brute force and scripted abuse, not a determined distributed attack.
const rateLimit = require('express-rate-limit');

const make = (windowMinutes, max, message, keyGenerator) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  limit: max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  ...(keyGenerator ? { keyGenerator } : {}),
  handler: (_req, res) => res.status(429).json({ success: false, message }),
});

module.exports = {
  // Guessing passwords
  login: make(15, 10, 'Too many sign-in attempts. Try again in a few minutes.'),
  // Mass account creation
  register: make(60, 10, 'Too many sign-ups from this network. Try again later.'),
  // Reset-token flooding and guessing
  passwordReset: make(60, 8, 'Too many password reset requests. Try again later.'),
  // Guessing family codes (keyed by the signed-in user)
  familyJoin: make(15, 8, 'Too many attempts. Try again in a few minutes.', (req) => `u:${req.user?.userId || 'anon'}`),
  // Generous ceiling for everything else, per IP
  api: make(1, 600, 'Too many requests. Slow down and try again.'),
};
