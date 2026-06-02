const { query } = require('../db');

// GET /api/dashboard/summary
const getSummary = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { month, year, wallet_id } = req.query;
    const now = new Date();
    const m = parseInt(month) || now.getMonth() + 1;
    const y = parseInt(year) || now.getFullYear();

    const startDate = `${y}-${String(m).padStart(2,'0')}-01`;
    const endDate = m === 12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2,'0')}-01`;
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    const prevStart = `${prevY}-${String(prevM).padStart(2,'0')}-01`;

    // Build optional wallet filter
    const wCond = wallet_id ? `AND wallet_id = $4` : '';
    const baseParams = (extra) => wallet_id ? [userId, ...extra, wallet_id] : [userId, ...extra];

    const [statsRes, prevStats, balRes, goalsRes] = await Promise.all([
      query(
        `SELECT
          COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS income,
          COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expense
         FROM transactions
         WHERE user_id=$1 AND transaction_date>=$2 AND transaction_date<$3 AND status='completed' ${wCond}`,
        baseParams([startDate, endDate])
      ),
      query(
        `SELECT
          COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS income,
          COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expense
         FROM transactions
         WHERE user_id=$1 AND transaction_date>=$2 AND transaction_date<$3 AND status='completed' ${wCond}`,
        baseParams([prevStart, startDate])
      ),
      wallet_id
        ? query('SELECT COALESCE(balance,0) AS total_balance FROM wallets WHERE id=$1 AND user_id=$2', [wallet_id, userId])
        : query(`SELECT COALESCE(SUM(
            CASE WHEN type IN ('visa','mastercard','loan')
              THEN -ABS(balance)
              ELSE balance
            END
          ),0) AS total_balance FROM wallets WHERE user_id=$1`, [userId]),
      query('SELECT COALESCE(SUM(current_amount),0) AS total_savings FROM saving_goals WHERE user_id=$1', [userId]),
    ]);

    const curr = statsRes.rows[0];
    const prev = prevStats.rows[0];
    const pctChange = (c, p) => p == 0 ? 0 : (((c - p) / p) * 100).toFixed(1);

    res.json({
      success: true,
      data: {
        total_balance: parseFloat(balRes.rows[0]?.total_balance || 0),
        income: parseFloat(curr.income),
        expense: parseFloat(curr.expense),
        total_savings: parseFloat(goalsRes.rows[0].total_savings),
        income_change: pctChange(curr.income, prev.income),
        expense_change: pctChange(curr.expense, prev.expense),
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/dashboard/money-flow
const getMoneyFlow = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { year, wallet_id } = req.query;
    const y = parseInt(year) || new Date().getFullYear();

    const wCond = wallet_id ? 'AND wallet_id = $3' : '';
    const params = wallet_id ? [userId, y, wallet_id] : [userId, y];

    const result = await query(`
      SELECT
        EXTRACT(MONTH FROM transaction_date) AS month,
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expense
      FROM transactions
      WHERE user_id=$1 AND EXTRACT(YEAR FROM transaction_date)=$2 AND status='completed' ${wCond}
      GROUP BY EXTRACT(MONTH FROM transaction_date)
      ORDER BY month
    `, params);

    const months = Array.from({ length: 12 }, (_, i) => {
      const found = result.rows.find(r => parseInt(r.month) === i + 1);
      return { month: i + 1, income: found ? parseFloat(found.income) : 0, expense: found ? parseFloat(found.expense) : 0 };
    });

    res.json({ success: true, data: months });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/dashboard/recent-transactions
const getRecentTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 5, wallet_id } = req.query;

    const wCond = wallet_id ? 'AND t.wallet_id = $3' : '';
    const params = wallet_id ? [userId, parseInt(limit), wallet_id] : [userId, parseInt(limit)];

    const result = await query(`
      SELECT t.id, t.type, t.amount, t.description, t.payment_name, t.status,
             t.transaction_date, w.name AS wallet_name, w.type AS wallet_type,
             w.last_four, c.name AS category_name, c.emoji AS category_emoji, c.color AS category_color
      FROM transactions t
      LEFT JOIN wallets w ON t.wallet_id = w.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id=$1 ${wCond}
      ORDER BY t.transaction_date DESC
      LIMIT $2
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getSummary, getMoneyFlow, getRecentTransactions };
