const { query } = require('../db');
const { encrypt, decryptRow } = require('../utils/crypto');

const decrypt = row => decryptRow(row, ['payment_name', 'description']);

const FREE_RECURRING_LIMIT = 5;

async function isPremium(userId) {
  const r = await query('SELECT is_premium, premium_expires_at FROM users WHERE id=$1', [userId]);
  const u = r.rows[0];
  if (!u || !u.is_premium) return false;
  if (u.premium_expires_at && new Date(u.premium_expires_at) < new Date()) return false;
  return true;
}

// Calculate next run date based on frequency
function calcNextRun(from, frequency) {
  const d = new Date(from);
  switch (frequency) {
    case 'daily':   d.setDate(d.getDate() + 1);     break;
    case 'weekly':  d.setDate(d.getDate() + 7);     break;
    case 'monthly': d.setMonth(d.getMonth() + 1);   break;
    case 'yearly':  d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split('T')[0];
}

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
    const premium = await isPremium(req.user.userId);
    if (!premium) {
      const cnt = await query('SELECT COUNT(*) FROM recurring_transactions WHERE user_id=$1 AND is_active=true', [req.user.userId]);
      if (parseInt(cnt.rows[0].count) >= FREE_RECURRING_LIMIT) {
        return res.status(403).json({
          success: false,
          code: 'FREE_LIMIT_RECURRING',
          message: `Free plan allows up to ${FREE_RECURRING_LIMIT} recurring transactions. Upgrade to Premium for unlimited.`,
        });
      }
    }
    const { wallet_id, category_id, type, amount, payment_name, description, frequency, start_date, end_date } = req.body;
    if (!type || !amount || !payment_name || !frequency || !start_date) {
      return res.status(400).json({ success: false, message: 'type, amount, payment_name, frequency, start_date required' });
    }
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
    const today = new Date().toISOString().split('T')[0];
    const due = await query(`
      SELECT * FROM recurring_transactions
      WHERE is_active = true AND next_run <= $1
        AND (end_date IS NULL OR end_date >= $1)
    `, [today]);

    let created = 0;
    for (const rec of due.rows) {
      // Insert actual transaction
      await query(`
        INSERT INTO transactions (user_id, wallet_id, category_id, type, amount, payment_name, description, transaction_date, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'completed')
      `, [rec.user_id, rec.wallet_id, rec.category_id, rec.type, rec.amount, rec.payment_name, rec.description, rec.next_run]);

      // Update wallet balance
      if (rec.wallet_id) {
        const delta = rec.type === 'income' ? rec.amount : -rec.amount;
        await query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [delta, rec.wallet_id]);
      }

      // Advance next_run
      const nextRun = calcNextRun(rec.next_run, rec.frequency);
      await query(`
        UPDATE recurring_transactions SET last_run=$1, next_run=$2, updated_at=NOW() WHERE id=$3
      `, [rec.next_run, nextRun, rec.id]);

      created++;
    }

    res.json({ success: true, processed: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, create, update, remove, process };
