const { query } = require('../db');
const { decryptRow } = require('../utils/crypto');
const { toYMD } = require('../utils/dates');
const { analyze } = require('../utils/insightsEngine');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};

// GET /api/insights/smart?month=YYYY-MM
// Reads up to six months of history so detectors are not limited to the latest rows.
const getSmart = async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = toYMD(new Date());
    const month = req.query.month || today.slice(0, 7);
    if (!MONTH_RE.test(month)) {
      return res.status(400).json({ success: false, message: 'month must look like 2026-11' });
    }
    const from = `${shiftMonth(month, -5)}-01`;
    const to = `${shiftMonth(month, 1)}-01`;

    const [txRes, ruleRes] = await Promise.all([
      query(`
        SELECT t.transaction_date, t.type, t.amount, t.payment_name, c.name AS category_name
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.user_id=$1 AND t.status='completed' AND t.type IN ('income','expense')
          AND t.transaction_date >= $2 AND t.transaction_date < $3
        ORDER BY t.transaction_date
      `, [userId, from, to]),
      query(`SELECT payment_name, amount FROM recurring_transactions WHERE user_id=$1 AND is_active = true AND type='expense'`, [userId]),
    ]);

    // transfer-in rows can carry an encrypted payment_name, so decrypt defensively
    const transactions = txRes.rows.map(r => {
      const d = decryptRow(r, ['payment_name']);
      return {
        date: toYMD(r.transaction_date), type: r.type, amount: parseFloat(r.amount) || 0,
        merchant: d.payment_name || '', category: r.category_name || null,
      };
    });
    const rules = ruleRes.rows.map(r => ({ name: decryptRow(r, ['payment_name']).payment_name, amount: r.amount }));

    res.json({ success: true, data: analyze({ today, month, transactions, rules }) });
  } catch (err) {
    console.error('insights.getSmart:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getSmart };
