const { query } = require('../db');

/**
 * Requires both a valid JWT (applied upstream via auth middleware)
 * AND is_admin = true on the users row.
 */
module.exports = async (req, res, next) => {
  if (!req.user?.userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  try {
    const result = await query('SELECT is_admin FROM users WHERE id=$1', [req.user.userId]);
    if (!result.rows[0]?.is_admin) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
  } catch (err) {
    console.error('adminAuth error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
