const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../db');

const generateToken = (userId, email) => {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'First name, last name, email and password are required' });
    }

    // Check existing user
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await query(`
      INSERT INTO users (first_name, last_name, email, password_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING id, first_name, last_name, email, currency, language, created_at
    `, [first_name, last_name, email.toLowerCase(), password_hash]);

    const user = result.rows[0];

    // Create default notification prefs
    await query('INSERT INTO notification_preferences (user_id) VALUES ($1)', [user.id]);

    const token = generateToken(user.id, user.email);
    res.status(201).json({ success: true, token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await query(
      'SELECT id, first_name, last_name, email, password_hash, currency, language, is_premium, premium_expires_at, is_admin FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Track last login time
    await query('UPDATE users SET last_login_at = NOW() WHERE id=$1', [user.id]);

    const { password_hash, ...safeUser } = user;
    const token = generateToken(user.id, user.email);
    res.json({ success: true, token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, first_name, last_name, email, currency, language, avatar_url, whatsapp_phone, is_premium, premium_expires_at, oauth_provider, is_admin, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, currency, language } = req.body;
    const result = await query(`
      UPDATE users SET first_name=$1, last_name=$2, currency=$3, language=$4, updated_at=NOW()
      WHERE id=$5
      RETURNING id, first_name, last_name, email, currency, language
    `, [first_name, last_name, currency, language, req.user.userId]);
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ success: false, message: 'Both current and new password required' });
    if (new_password.length < 8)
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });

    const result = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.userId]);
    const user = result.rows[0];
    if (!user || !user.password_hash)
      return res.status(400).json({ success: false, message: 'Cannot change password for OAuth accounts' });

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [newHash, req.user.userId]);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/auth/notification-preferences
const getNotificationPrefs = async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM notification_preferences WHERE user_id=$1',
      [req.user.userId]
    );
    if (!result.rows.length) {
      // create defaults if missing
      const ins = await query(
        'INSERT INTO notification_preferences (user_id) VALUES ($1) RETURNING *',
        [req.user.userId]
      );
      return res.json({ success: true, data: ins.rows[0] });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/auth/notification-preferences
const updateNotificationPrefs = async (req, res) => {
  try {
    const { transaction_alerts, budget_warnings, weekly_summary, goal_milestones } = req.body;
    const result = await query(`
      INSERT INTO notification_preferences (user_id, transaction_alerts, budget_warnings, weekly_summary, goal_milestones)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (user_id) DO UPDATE
        SET transaction_alerts=$2, budget_warnings=$3, weekly_summary=$4, goal_milestones=$5
      RETURNING *
    `, [req.user.userId, transaction_alerts, budget_warnings, weekly_summary, goal_milestones]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const result = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      // Don't reveal if email exists — but still return success to prevent enumeration
      return res.json({ success: true, message: 'If that email exists, a reset token was generated.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      'UPDATE users SET reset_token=$1, reset_token_expires=$2 WHERE email=$3',
      [token, expires, email.toLowerCase()]
    );

    // Since no email service is configured, return the token directly
    res.json({ success: true, token, message: 'Reset token generated. Use it within 1 hour.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password)
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    if (new_password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const result = await query(
      'SELECT id, email FROM users WHERE reset_token=$1 AND reset_token_expires > NOW()',
      [token]
    );
    if (result.rows.length === 0)
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });

    const user = result.rows[0];
    const hash = await bcrypt.hash(new_password, 10);

    await query(
      'UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expires=NULL, updated_at=NOW() WHERE id=$2',
      [hash, user.id]
    );

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { register, login, getMe, updateProfile, changePassword, getNotificationPrefs, updateNotificationPrefs, forgotPassword, resetPassword };
