const { query } = require('../db');
const { decryptRow } = require('../utils/crypto');

const TX_DEC_KEYS = ['description', 'wallet_name'];
const decryptTx   = row => decryptRow(row, TX_DEC_KEYS);

// GET /api/dashboard/summary
const getSummary = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { month, year, start_date, end_date, wallet_id } = req.query;
    const now = new Date();

    let startDate, endDate, prevStart, prevEnd;

    if (start_date && end_date) {
      // ── Custom date range ──────────────────────────
      startDate = start_date;
      // make end inclusive: add 1 day for the < comparison
      const endDt = new Date(end_date);
      endDt.setDate(endDt.getDate() + 1);
      endDate = endDt.toISOString().split('T')[0];

      // previous period = same duration immediately before
      const rangeDays = Math.round((new Date(end_date) - new Date(start_date)) / 86400000) + 1;
      const prevEndDt  = new Date(start_date);
      const prevStartDt = new Date(start_date);
      prevStartDt.setDate(prevStartDt.getDate() - rangeDays);
      prevStart = prevStartDt.toISOString().split('T')[0];
      prevEnd   = start_date; // exclusive upper bound
    } else {
      // ── Month / Year range ─────────────────────────
      const m = parseInt(month) || now.getMonth() + 1;
      const y = parseInt(year)  || now.getFullYear();
      startDate = `${y}-${String(m).padStart(2,'0')}-01`;
      endDate   = m === 12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2,'0')}-01`;
      const prevM = m === 1 ? 12 : m - 1;
      const prevY = m === 1 ? y - 1 : y;
      prevStart = `${prevY}-${String(prevM).padStart(2,'0')}-01`;
      prevEnd   = startDate;
    }

    // Build optional wallet filter
    const wCond = wallet_id ? `AND wallet_id = $4` : '';
    const baseParams = (extra) => wallet_id ? [userId, ...extra, wallet_id] : [userId, ...extra];

    const [statsRes, prevStats, balRes, goalsRes] = await Promise.all([
      query(
        `SELECT
          COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0)  AS income,
          COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expense
         FROM transactions
         WHERE user_id=$1 AND transaction_date>=$2 AND transaction_date<$3 AND status='completed' ${wCond}`,
        baseParams([startDate, endDate])
      ),
      query(
        `SELECT
          COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0)  AS income,
          COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expense
         FROM transactions
         WHERE user_id=$1 AND transaction_date>=$2 AND transaction_date<$3 AND status='completed' ${wCond}`,
        baseParams([prevStart, prevEnd])
      ),
      wallet_id
        ? query('SELECT COALESCE(balance,0) AS total_balance FROM wallets WHERE id=$1 AND user_id=$2', [wallet_id, userId])
        : query(`SELECT COALESCE(SUM(
            CASE WHEN type IN ('visa','mastercard','loan','lending')
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
        total_balance:  parseFloat(balRes.rows[0]?.total_balance || 0),
        income:         parseFloat(curr.income),
        expense:        parseFloat(curr.expense),
        total_savings:  parseFloat(goalsRes.rows[0].total_savings),
        income_change:  pctChange(curr.income,  prev.income),
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
    const { limit = 5, wallet_id, month, year, start_date, end_date } = req.query;

    const conditions = ['t.user_id=$1'];
    const params = [userId];
    let idx = 2;

    // Date range filter
    if (start_date && end_date) {
      const endDt = new Date(end_date);
      endDt.setDate(endDt.getDate() + 1);
      conditions.push(`t.transaction_date >= $${idx++}`);
      params.push(start_date);
      conditions.push(`t.transaction_date < $${idx++}`);
      params.push(endDt.toISOString().split('T')[0]);
    } else if (month && year) {
      const m = parseInt(month), y = parseInt(year);
      const sd = `${y}-${String(m).padStart(2,'0')}-01`;
      const ed = m === 12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2,'0')}-01`;
      conditions.push(`t.transaction_date >= $${idx++}`);
      params.push(sd);
      conditions.push(`t.transaction_date < $${idx++}`);
      params.push(ed);
    }

    // Wallet filter
    if (wallet_id) {
      conditions.push(`t.wallet_id = $${idx++}`);
      params.push(wallet_id);
    }

    params.push(parseInt(limit));
    const whereClause = conditions.join(' AND ');

    const result = await query(`
      SELECT t.id, t.type, t.amount, t.description, t.payment_name, t.status,
             t.transaction_date, w.name AS wallet_name, w.type AS wallet_type,
             w.last_four, c.name AS category_name, c.emoji AS category_emoji, c.color AS category_color
      FROM transactions t
      LEFT JOIN wallets w ON t.wallet_id = w.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE ${whereClause}
      ORDER BY t.transaction_date DESC
      LIMIT $${idx}
    `, params);

    res.json({ success: true, data: result.rows.map(decryptTx) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/dashboard/category-breakdown
const getCategoryBreakdown = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { year, month, start_date, end_date } = req.query;
    const now = new Date();
    let startDate, endDate;
    if (start_date && end_date) {
      startDate = start_date;
      const endDt = new Date(end_date);
      endDt.setDate(endDt.getDate() + 1);
      endDate = endDt.toISOString().split('T')[0];
    } else {
      const y = parseInt(year) || now.getFullYear();
      startDate = month
        ? `${y}-${String(parseInt(month)).padStart(2,'0')}-01`
        : `${y}-01-01`;
      endDate = month
        ? (parseInt(month) === 12 ? `${y+1}-01-01` : `${y}-${String(parseInt(month)+1).padStart(2,'0')}-01`)
        : `${y+1}-01-01`;
    }

    const result = await query(`
      SELECT
        COALESCE(c.name, 'Uncategorized') AS name,
        COALESCE(c.emoji, '📌') AS emoji,
        COALESCE(c.color, '#6C63FF') AS color,
        COALESCE(SUM(t.amount), 0) AS value
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1
        AND t.type = 'expense'
        AND t.status = 'completed'
        AND t.transaction_date >= $2
        AND t.transaction_date < $3
      GROUP BY c.name, c.emoji, c.color
      ORDER BY value DESC
      LIMIT 8
    `, [userId, startDate, endDate]);

    res.json({ success: true, data: result.rows.map(r => ({ ...r, value: parseFloat(r.value) })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/dashboard/analytics-stats
const getAnalyticsStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { year } = req.query;
    const now = new Date();
    const y = parseInt(year) || now.getFullYear();
    const startDate = `${y}-01-01`;
    const endDate = `${y+1}-01-01`;
    const daysInYear = y % 4 === 0 ? 366 : 365;
    const daysSoFar = Math.min(daysInYear, Math.ceil((now - new Date(startDate)) / 86400000));

    const [statsRes, maxTxRes] = await Promise.all([
      query(`
        SELECT
          COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END),0) AS income,
          COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expense
        FROM transactions
        WHERE user_id=$1 AND transaction_date>=$2 AND transaction_date<$3 AND status='completed'
      `, [userId, startDate, endDate]),
      query(`
        SELECT COALESCE(MAX(amount),0) AS max_expense
        FROM transactions
        WHERE user_id=$1 AND type='expense' AND status='completed'
          AND transaction_date>=$2 AND transaction_date<$3
      `, [userId, startDate, endDate]),
    ]);

    const income  = parseFloat(statsRes.rows[0].income);
    const expense = parseFloat(statsRes.rows[0].expense);
    const avgDaily    = daysSoFar > 0 ? expense / daysSoFar : 0;
    const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
    const maxExpense  = parseFloat(maxTxRes.rows[0].max_expense);

    res.json({ success: true, data: { income, expense, avg_daily: avgDaily, savings_rate: savingsRate, largest_expense: maxExpense } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/dashboard/balance-history?start_date&end_date&scope=spendable|total&wallet_id
// Authoritative daily END balance, computed from the transactions ledger.
const getBalanceHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { start_date, end_date, scope = 'spendable', wallet_id } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'start_date and end_date are required' });
    }

    // Which wallets count toward the balance line
    const typeCond = scope === 'total' ? '' : `AND type IN ('bank','cash')`;
    const wRes = wallet_id
      ? await query(`SELECT id, COALESCE(balance,0) AS balance FROM wallets WHERE id=$1 AND user_id=$2`, [wallet_id, userId])
      : await query(`SELECT id, COALESCE(balance,0) AS balance FROM wallets WHERE user_id=$1 ${typeCond}`, [userId]);
    const walletIds = wRes.rows.map(r => r.id);
    const currentBal = wRes.rows.reduce((s, r) => s + parseFloat(r.balance || 0), 0);
    if (!walletIds.length) return res.json({ success: true, data: [] });

    // Every completed transaction touching those wallets from start_date onward
    const txRes = await query(`
      SELECT transaction_date, type, amount, transfer_direction
      FROM transactions
      WHERE user_id=$1 AND wallet_id = ANY($2) AND status='completed' AND transaction_date >= $3
      ORDER BY transaction_date
    `, [userId, walletIds, start_date]);

    const delta = (t) => {
      const a = parseFloat(t.amount || 0);
      if (t.type === 'income') return a;
      if (t.type === 'expense') return -a;
      if (t.type === 'transfer') return t.transfer_direction === 'in' ? a : -a;
      return 0;
    };
    const dayKey = (d) => new Date(d).toISOString().split('T')[0];
    const dayDelta = {};
    let totalDelta = 0;
    txRes.rows.forEach(t => { const d = delta(t); totalDelta += d; dayDelta[dayKey(t.transaction_date)] = (dayDelta[dayKey(t.transaction_date)] || 0) + d; });

    // Balance just before start_date, then walk forward day by day
    let run = currentBal - totalDelta;
    const out = [];
    const end = new Date(end_date);
    for (let d = new Date(start_date); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      run += (dayDelta[key] || 0);
      out.push({ date: key, balance: Math.round(run * 100) / 100 });
    }

    res.json({ success: true, data: out });
  } catch (err) {
    console.error('getBalanceHistory:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* Upsert today's balance snapshot (spendable + total). Safe to call after any
   transaction/wallet change; failures never block the request. */
async function recordBalanceSnapshot(userId) {
  try {
    await query(`
      INSERT INTO balance_snapshots (user_id, snapshot_date, spendable_balance, total_balance)
      SELECT $1, CURRENT_DATE,
        COALESCE(SUM(CASE WHEN type IN ('bank','cash') THEN balance ELSE 0 END),0),
        COALESCE(SUM(balance),0)
      FROM wallets WHERE user_id=$1
      ON CONFLICT (user_id, snapshot_date)
      DO UPDATE SET spendable_balance=EXCLUDED.spendable_balance, total_balance=EXCLUDED.total_balance
    `, [userId]);
  } catch (e) { /* snapshot table may not exist yet on first deploy */ }
}

module.exports = { getSummary, getMoneyFlow, getRecentTransactions, getCategoryBreakdown, getAnalyticsStats, getBalanceHistory, recordBalanceSnapshot };
