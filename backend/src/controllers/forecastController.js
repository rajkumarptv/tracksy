const { query } = require('../db');
const { decryptRow } = require('../utils/crypto');
const { toYMD, addDays, diffDays } = require('../utils/dates');
const { buildForecast, variableSpend } = require('../utils/forecastEngine');
const { COMMITMENT } = require('./analyticsController');

const SPENDABLE = ['bank', 'cash'];
const CARD_TYPES = ['visa', 'mastercard'];
const LOAN_TYPES = ['loan', 'home_loan', 'vehicle_loan', 'personal_loan', 'gold_loan', 'education_loan', 'emi'];
// Rows written by "Pay liability" in resourceController, i.e. debt repayments rather than everyday spend
const LOAN_PAYMENT_NAME = /^(interest|principal) payment$/i;

// GET /api/forecast/cashflow?days=60
const getCashflow = async (req, res) => {
  try {
    const userId = req.user.userId;
    const days = Math.min(120, Math.max(7, parseInt(req.query.days, 10) || 60));
    const today = toYMD(new Date());

    const [walletRes, recurringRes, firstTx] = await Promise.all([
      query(`SELECT id, name, type, balance, emi_amount, emi_day, payment_day FROM wallets WHERE user_id=$1`, [userId]),
      query(`
        SELECT r.*, w.type AS wallet_type
        FROM recurring_transactions r
        LEFT JOIN wallets w ON w.id = r.wallet_id
        WHERE r.user_id=$1 AND r.is_active = true
      `, [userId]),
      query(`SELECT MIN(transaction_date) AS first FROM transactions WHERE user_id=$1`, [userId]),
    ]);

    const wallets = walletRes.rows.map(w => decryptRow(w, ['name']));
    const startBalance = wallets.filter(w => SPENDABLE.includes(w.type))
      .reduce((s, w) => s + (parseFloat(w.balance) || 0), 0);
    const cards = wallets.filter(w => CARD_TYPES.includes(w.type));
    const loans = wallets.filter(w => LOAN_TYPES.includes(w.type));

    // A recurring rule that already equals a loan's EMI is the same payment: count it once (as the rule).
    const emiRules = recurringRes.rows.filter(r => r.type === 'expense').map(r => parseFloat(r.amount));
    const loansToModel = loans.filter(l => !emiRules.some(a => Math.abs(a - (parseFloat(l.emi_amount) || 0)) < 1));

    const recurring = recurringRes.rows.map(r => {
      const d = decryptRow(r, ['payment_name']);
      return {
        name: d.payment_name, type: r.type, amount: r.amount, frequency: r.frequency,
        start_date: r.start_date, next_run: r.next_run, end_date: r.end_date,
        spendable: !r.wallet_type || SPENDABLE.includes(r.wallet_type),
      };
    });

    // Everyday spend: completed bank/cash expenses of the last 60 days, minus recurring-generated,
    // commitment-category (rent, bills, EMIs...) and loan-repayment rows, which are modelled separately.
    const since = addDays(today, -60);
    const txRes = await query(`
      SELECT t.transaction_date, t.amount, t.payment_name, c.name AS category_name
      FROM transactions t
      JOIN wallets w ON w.id = t.wallet_id
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id=$1 AND t.type='expense' AND t.status='completed'
        AND w.type = ANY($2) AND t.recurring_id IS NULL AND t.transaction_date >= $3
    `, [userId, SPENDABLE, since]);
    const rows = txRes.rows
      .filter(t => {
        const cat = (t.category_name || '').toLowerCase();
        if (COMMITMENT.some(k => cat.includes(k))) return false;
        return !LOAN_PAYMENT_NAME.test((t.payment_name || '').trim());
      })
      .map(t => ({ date: toYMD(t.transaction_date), amount: t.amount }));

    const first = firstTx.rows[0] && firstTx.rows[0].first;
    const historyDays = first ? Math.max(1, diffDays(toYMD(first), today)) : 1;
    const variable = variableSpend(rows, today, historyDays);

    const forecast = buildForecast({ today, days, startBalance, recurring, cards, loans: loansToModel, variable });
    res.json({ success: true, data: forecast });
  } catch (err) {
    console.error('forecast.getCashflow:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getCashflow };
