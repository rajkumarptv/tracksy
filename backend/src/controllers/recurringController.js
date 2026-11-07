const { query } = require('../db');
const { encrypt, decryptRow } = require('../utils/crypto');
const { parseAmount } = require('../utils/validate');
const { addPeriod, toYMD, parseYMD } = require('../utils/dates');
const { foreignIdProblem } = require('../utils/ownership');

const decrypt = row => decryptRow(row, ['payment_name', 'description']);

// Next run date: month-end safe (Jan 31 -> Feb 28 -> Mar 31) and free of UTC day shifts.
// `startDate` anchors the day-of-month so monthly rules don't drift after a short month.
function calcNextRun(from, frequency, startDate) {
  return addPeriod(from, frequency, startDate ? parseYMD(startDate).d : undefined);
}

const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];
const validateRecurring = ({ type, amount, payment_name, frequency, start_date, end_date }) => {
  if (!['income', 'expense'].includes(type)) return 'Type must be income or expense';
  if (!payment_name || !String(payment_name).trim()) return 'Please enter a name';
  if (parseAmount(amount) === null) return 'Please enter a valid amount greater than 0';
  if (!FREQUENCIES.includes(frequency)) return 'Invalid frequency';
  if (!start_date) return 'Please choose a start date';
  if (end_date && end_date < start_date) return 'End date must be on or after the start date';
  return null;
};

// GET /recurring
const getAll = async (req, res) => {
  try {
    const result = await query(`
      SELECT r.*, w.name AS wallet_name, c.name AS category_name, c.emoji AS category_emoji, c.color AS category_color
      FROM recurring_transactions r
      LEFT JOIN wallets w ON w.id = r.wallet_id
      LEFT JOIN categories c ON c.id = r.category_id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
    `, [req.user.userId]);
    res.json({ success: true, data: result.rows.map(decrypt) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /recurring
const create = async (req, res) => {
  try {
    const { wallet_id, category_id, type, amount, payment_name, description, frequency, start_date, end_date } = req.body;
    const invalid = validateRecurring(req.body);
    if (invalid) return res.status(400).json({ success: false, message: invalid });
    const foreign = await foreignIdProblem(req.user.userId, { wallets: [wallet_id], categories: [category_id] });
    if (foreign) return res.status(404).json({ success: false, message: foreign });
    const result = await query(`
      INSERT INTO recurring_transactions
        (user_id, wallet_id, category_id, type, amount, payment_name, description, frequency, start_date, end_date, next_run)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [
      req.user.userId, wallet_id || null, category_id || null,
      type, amount, encrypt(payment_name), description ? encrypt(description) : null,
      frequency, start_date, end_date || null, start_date,
    ]);
    res.status(201).json({ success: true, data: decrypt(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /recurring/:id
const update = async (req, res) => {
  try {
    const { wallet_id, category_id, type, amount, payment_name, description, frequency, start_date, end_date, is_active, next_run } = req.body;
    const invalid = validateRecurring(req.body);
    if (invalid) return res.status(400).json({ success: false, message: invalid });
    const foreign = await foreignIdProblem(req.user.userId, { wallets: [wallet_id], categories: [category_id] });
    if (foreign) return res.status(404).json({ success: false, message: foreign });
    const result = await query(`
      UPDATE recurring_transactions
      SET wallet_id=$1, category_id=$2, type=$3, amount=$4, payment_name=$5,
          description=$6, frequency=$7, start_date=$8, end_date=$9,
          is_active=$10, next_run=$11, updated_at=NOW()
      WHERE id=$12 AND user_id=$13 RETURNING *
    `, [
      wallet_id || null, category_id || null, type, amount,
      encrypt(payment_name), description ? encrypt(description) : null,
      frequency, start_date, end_date || null,
      is_active !== undefined ? is_active : true,
      next_run || start_date,
      req.params.id, req.user.userId,
    ]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: decrypt(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /recurring/:id
const remove = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM recurring_transactions WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.userId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /recurring/process — run due recurring transactions (called by cron or manually)
const process = async (req, res) => {
  try {
    const today = toYMD(new Date());
    // Only the caller's own rules (this used to post every user's due rules).
    const due = await query(`
      SELECT * FROM recurring_transactions
      WHERE user_id = $2 AND is_active = true AND next_run <= $1
        AND (end_date IS NULL OR end_date >= $1)
    `, [today, req.user.userId]);

    let created = 0;
    for (const rec of due.rows) {
      // Insert actual transaction
      await query(`
        INSERT INTO transactions (user_id, wallet_id, category_id, type, amount, payment_name, description, transaction_date, status, recurring_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'completed',$9)
      `, [rec.user_id, rec.wallet_id, rec.category_id, rec.type, rec.amount, rec.payment_name, rec.description, rec.next_run, rec.id]);

      // Update wallet balance
      if (rec.wallet_id) {
        const delta = rec.type === 'income' ? rec.amount : -rec.amount;
        await query('UPDATE wallets SET balance = balance + $1 WHERE id = $2 AND user_id = $3', [delta, rec.wallet_id, rec.user_id]);
      }

      // Advance next_run
      const nextRun = calcNextRun(rec.next_run, rec.frequency, rec.start_date);
      // Past the end date there is nothing left to run, so retire the rule.
      const finished = rec.end_date && nextRun > toYMD(rec.end_date);
      await query(`
        UPDATE recurring_transactions SET last_run=$1, next_run=$2, is_active=$3, updated_at=NOW() WHERE id=$4
      `, [rec.next_run, nextRun, !finished, rec.id]);

      created++;
    }

    res.json({ success: true, processed: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, create, update, remove, process };
