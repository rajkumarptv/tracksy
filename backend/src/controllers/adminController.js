const { query } = require('../db');

// ── GET /api/admin/stats ─────────────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const [
      totalUsers,
      newToday, newWeek, newMonth,
      activeWeek, activeMonth,
      totalTx, totalWallets, totalGoals,
      recentUsers, dailySignups,
    ] = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '1 day'"),
      query("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"),
      query("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days'"),
      query("SELECT COUNT(*) FROM users WHERE last_login_at >= NOW() - INTERVAL '7 days'"),
      query("SELECT COUNT(*) FROM users WHERE last_login_at >= NOW() - INTERVAL '30 days'"),
      query('SELECT COUNT(*) FROM transactions'),
      query('SELECT COUNT(*) FROM wallets'),
      query('SELECT COUNT(*) FROM saving_goals'),
      query(`
        SELECT id, first_name, last_name, email, is_premium, created_at, last_login_at
        FROM users ORDER BY created_at DESC LIMIT 10
      `),
      query(`
        SELECT TO_CHAR(DATE(created_at), 'Mon DD') AS date, COUNT(*) AS count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `),
    ]);

    const total   = parseInt(totalUsers.rows[0].count);

    res.json({
      success: true,
      data: {
        users: {
          total,
          new_today:    parseInt(newToday.rows[0].count),
          new_week:     parseInt(newWeek.rows[0].count),
          new_month:    parseInt(newMonth.rows[0].count),
          active_week:  parseInt(activeWeek.rows[0].count),
          active_month: parseInt(activeMonth.rows[0].count),
        },
        content: {
          transactions: parseInt(totalTx.rows[0].count),
          wallets:      parseInt(totalWallets.rows[0].count),
          goals:        parseInt(totalGoals.rows[0].count),
        },
        recent_users:  recentUsers.rows,
        daily_signups: dailySignups.rows,
      },
    });
  } catch (err) {
    console.error('adminGetStats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/admin/users ─────────────────────────────────────────────────────
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset  = (parseInt(page) - 1) * parseInt(limit);
    const pattern = `%${search}%`;

    const [data, count] = await Promise.all([
      query(`
        SELECT u.id, u.first_name, u.last_name, u.email,
               u.is_admin, u.oauth_provider,
               u.created_at, u.last_login_at,
               (SELECT COUNT(*) FROM transactions WHERE user_id = u.id)::int AS tx_count,
               (SELECT COUNT(*) FROM wallets      WHERE user_id = u.id)::int AS wallet_count
        FROM users u
        WHERE u.email ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1
        ORDER BY u.created_at DESC
        LIMIT $2 OFFSET $3
      `, [pattern, parseInt(limit), offset]),
      query(
        `SELECT COUNT(*) FROM users WHERE email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1`,
        [pattern]
      ),
    ]);

    res.json({
      success: true,
      data: data.rows,
      pagination: {
        total: parseInt(count.rows[0].count),
        page:  parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(parseInt(count.rows[0].count) / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('adminGetUsers error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/admin/families ── (read-only oversight) ─────────────────────────
const listFamilies = async (req, res) => {
  try {
    const families = (await query(`
      SELECT f.id, f.name, f.family_code, f.created_at,
             pu.first_name || ' ' || pu.last_name AS primary_name,
             pu.email AS primary_email,
             (SELECT COUNT(*) FROM users WHERE family_id=f.id) AS member_count
      FROM families f
      LEFT JOIN users pu ON f.primary_user_id = pu.id
      ORDER BY f.created_at DESC
    `)).rows;

    for (const fam of families) {
      fam.members = (await query(
        `SELECT id, first_name || ' ' || last_name AS name, email, family_role
         FROM users WHERE family_id=$1 ORDER BY family_role='primary' DESC`,
        [fam.id]
      )).rows;
      fam.member_count = parseInt(fam.member_count);
    }

    res.json({ success:true, data: families });
  } catch (err) {
    console.error('List families error:', err);
    res.status(500).json({ success:false, message:'Server error' });
  }
};

module.exports = { getStats, getUsers, listFamilies };
