const { query } = require('../db');

const FREE_BUDGET_LIMIT = 3;

async function isPremium(userId) {
  const r = await query('SELECT is_premium, premium_expires_at FROM users WHERE id=$1', [userId]);
  const u = r.rows[0];
  if (!u || !u.is_premium) return false;
  if (u.premium_expires_at && new Date(u.premium_expires_at) < new Date()) return false;
  return true;
}

// GET /api/budgets
const getAll = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { month, year } = req.query;
    const now = new Date();
    const m = parseInt(month) || now.getMonth() + 1;
    const y = parseInt(year) || now.getFullYear();
    const startDate = `${y}-${String(m).padStart(2,'0')}-01`;
    const endDate = m === 12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2,'0')}-01`;

    const result = await query(`
      SELECT b.*, c.name AS category_name, c.emoji AS category_emoji,
        COALESCE((
          SELECT SUM(t.amount) FROM transactions t
          WHERE t.user_id=b.user_id AND t.category_id=b.category_id
            AND t.type=COALESCE(b.type,'expense') AND t.status='completed'
            AND t.transaction_date >= $2 AND t.transaction_date < $3
        ), 0) AS spent
      FROM budgets b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = $1
      ORDER BY b.created_at
    `, [userId, startDate, endDate]);

    res.json({ success: true, data: result.rows.map(b => ({
      ...b,
      spent: parseFloat(b.spent),
      amount: parseFloat(b.amount),
      remaining: parseFloat(b.amount) - parseFloat(b.spent),
      percentage: b.amount > 0 ? Math.min(100, (parseFloat(b.spent) / parseFloat(b.amount)) * 100).toFixed(1) : 0
    })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/budgets
const create = async (req, res) => {
  try {
    const premium = await isPremium(req.user.userId);
    if (!premium) {
      const cnt = await query('SELECT COUNT(*) FROM budgets WHERE user_id=$1', [req.user.userId]);
      if (parseInt(cnt.rows[0].count) >= FREE_BUDGET_LIMIT) {
        return res.status(403).json({
          success: false,
          code: 'FREE_LIMIT_BUDGETS',
          message: `Free plan allows up to ${FREE_BUDGET_LIMIT} budgets. Upgrade to Premium for unlimited budgets.`,
        });
      }
    }
    const { category_id, name, amount, period, start_date, emoji, color, type } = req.body;
    if (!amount || isNaN(parseFloat(amount))) {
      return res.status(400).json({ success: false, message: 'Please enter a valid amount' });
    }
    const result = await query(`
      INSERT INTO budgets (user_id, category_id, name, amount, period, start_date, emoji, color, type)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [
      req.user.userId,
      category_id || null,
      name || 'Budget',
      parseFloat(amount),
      period || 'monthly',
      start_date || new Date().toISOString().slice(0, 8) + '01',
      emoji || '📌',
      color || '#6c5ce7',
      type === 'income' ? 'income' : 'expense',
    ]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/budgets/:id
const update = async (req, res) => {
  try {
    const { name, amount, emoji, color } = req.body;
    if (!amount || isNaN(parseFloat(amount))) {
      return res.status(400).json({ success: false, message: 'Please enter a valid amount' });
    }
    const result = await query(`
      UPDATE budgets SET name=$1, amount=$2, emoji=$3, color=$4, updated_at=NOW()
      WHERE id=$5 AND user_id=$6 RETURNING *
    `, [name || 'Budget', parseFloat(amount), emoji || '📌', color || '#6c5ce7', req.params.id, req.user.userId]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Budget not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/budgets/:id
const remove = async (req, res) => {
  try {
    const result = await query('DELETE FROM budgets WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.user.userId]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Budget not found' });
    res.json({ success: true, message: 'Budget deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, create, update, remove };
