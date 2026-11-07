const { query } = require('../db');
const { randomUUID } = require('crypto');
const { encrypt, decrypt, decryptRow } = require('../utils/crypto');
const { recordBalanceSnapshot } = require('./dashboardController');
const { parseAmount } = require('../utils/validate');
const { foreignIdProblem } = require('../utils/ownership');

// Fields to decrypt on every transaction row returned to client
// payment_name is intentionally NOT encrypted — it's needed for ILIKE search
const TX_DEC_KEYS = ['description', 'wallet_name'];
const decryptTx   = row => decryptRow(row, TX_DEC_KEYS);

const CREDIT_TYPES = ['visa', 'mastercard'];

const BASE_SELECT = `
  SELECT t.id, t.type, t.amount, t.description, t.payment_name, t.status,
         t.transaction_date, t.created_at, t.transfer_pair_id, t.transfer_direction,
         w.name AS wallet_name, w.type AS wallet_type, w.last_four,
         c.name AS category_name, c.emoji AS category_emoji, c.color AS category_color,
         c.id AS category_id, w.id AS wallet_id
  FROM transactions t
  LEFT JOIN wallets w ON t.wallet_id = w.id
  LEFT JOIN categories c ON t.category_id = c.id
`;

// ── GET /api/transactions ────────────────────────────────────────────────────
const getAll = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type, category_id, wallet_id, status, start_date, end_date, search, page = 1, limit = 20 } = req.query;

    let conditions = ['t.user_id = $1'];
    let params = [userId];
    let idx = 2;

    if (type && type !== 'all') { conditions.push(`t.type = $${idx++}`); params.push(type); }
    if (category_id) { conditions.push(`t.category_id = $${idx++}`); params.push(category_id); }
    if (wallet_id)   { conditions.push(`t.wallet_id = $${idx++}`);    params.push(wallet_id); }
    if (status)      { conditions.push(`t.status = $${idx++}`);       params.push(status); }
    if (start_date)  { conditions.push(`t.transaction_date >= $${idx++}`); params.push(start_date); }
    if (end_date)    { conditions.push(`t.transaction_date < $${idx++}`);  params.push(end_date); }
    // payment_name is stored as-is (not encrypted) for search support
    if (search)      { conditions.push(`t.payment_name ILIKE $${idx}`); params.push(`%${search}%`); idx++; }

    const where  = 'WHERE ' + conditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [dataRes, countRes] = await Promise.all([
      query(`${BASE_SELECT} ${where} ORDER BY t.transaction_date DESC LIMIT $${idx} OFFSET $${idx+1}`,
        [...params, parseInt(limit), offset]),
      query(`SELECT COUNT(*) FROM transactions t ${where}`, params),
    ]);

    res.json({
      success: true,
      data: dataRes.rows.map(decryptTx),
      pagination: {
        total: parseInt(countRes.rows[0].count),
        page:  parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(parseInt(countRes.rows[0].count) / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/transactions/:id ────────────────────────────────────────────────
const getById = async (req, res) => {
  try {
    const result = await query(`${BASE_SELECT} WHERE t.id=$1 AND t.user_id=$2`, [req.params.id, req.user.userId]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: decryptTx(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/transactions ───────────────────────────────────────────────────
const create = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type, amount, description, payment_name, status, transaction_date,
            wallet_id, category_id,
            // transfer-specific
            from_wallet_id, to_wallet_id } = req.body;

    if (!['income', 'expense', 'transfer'].includes(type) || parseAmount(amount) === null) {
      return res.status(400).json({ success: false, message: 'A valid type and an amount between ₹0.01 and ₹99,99,99,999 are required' });
    }

    const foreign = await foreignIdProblem(userId, { wallets: [wallet_id, from_wallet_id, to_wallet_id], categories: [category_id] });
    if (foreign) return res.status(404).json({ success: false, message: foreign });

    // ── TRANSFER ──────────────────────────────────────────────────────────────
    if (type === 'transfer') {
      if (!from_wallet_id || !to_wallet_id) {
        return res.status(400).json({ success: false, message: 'from_wallet_id and to_wallet_id are required for transfers' });
      }
      if (from_wallet_id === to_wallet_id) {
        return res.status(400).json({ success: false, message: 'Source and destination accounts must be different' });
      }

      // Fetch wallet names & types for labels
      const [fromRes, toRes] = await Promise.all([
        query('SELECT name, type FROM wallets WHERE id=$1 AND user_id=$2', [from_wallet_id, userId]),
        query('SELECT name, type FROM wallets WHERE id=$1 AND user_id=$2', [to_wallet_id,   userId]),
      ]);
      if (!fromRes.rows.length || !toRes.rows.length) {
        return res.status(404).json({ success: false, message: 'Wallet not found' });
      }

      const fromWallet = { ...fromRes.rows[0], name: decrypt(fromRes.rows[0].name) };
      const toWallet   = { ...toRes.rows[0],   name: decrypt(toRes.rows[0].name) };
      const pairId     = randomUUID();
      const txDate     = transaction_date || new Date();
      const txStatus   = status || 'completed';
      const isCreditCard = CREDIT_TYPES.includes(toWallet.type);

      // Determine labels
      const outDesc = isCreditCard
        ? `Credit card payment → ${toWallet.name}`
        : `Transfer → ${toWallet.name}`;
      const inDesc = isCreditCard
        ? `Payment received ← ${fromWallet.name}`
        : `Transfer ← ${fromWallet.name}`;

      // OUT transaction (debit from source)
      const outRes = await query(`
        INSERT INTO transactions
          (user_id, wallet_id, category_id, type, amount, description, payment_name, status, transaction_date, transfer_pair_id, transfer_direction)
        VALUES ($1,$2,$3,'transfer',$4,$5,$6,$7,$8,$9,'out')
        RETURNING id
      `, [userId, from_wallet_id, category_id || null, amount, encrypt(outDesc), payment_name || outDesc, txStatus, txDate, pairId]);

      // IN transaction (credit to destination)
      await query(`
        INSERT INTO transactions
          (user_id, wallet_id, category_id, type, amount, description, payment_name, status, transaction_date, transfer_pair_id, transfer_direction)
        VALUES ($1,$2,$3,'transfer',$4,$5,$6,$7,$8,$9,'in')
        RETURNING id
      `, [userId, to_wallet_id, category_id || null, amount, encrypt(inDesc), encrypt(payment_name || inDesc), txStatus, txDate, pairId]);

      // Update balances
      await query('UPDATE wallets SET balance = balance - $1 WHERE id=$2 AND user_id=$3', [amount, from_wallet_id, userId]);
      await query('UPDATE wallets SET balance = balance + $1 WHERE id=$2 AND user_id=$3', [amount, to_wallet_id,   userId]);

      const full = await query(`${BASE_SELECT} WHERE t.id=$1`, [outRes.rows[0].id]);
      recordBalanceSnapshot(userId);
      return res.status(201).json({ success: true, data: decryptTx(full.rows[0]), is_transfer: true, is_credit_card_payment: isCreditCard });
    }

    // ── INCOME / EXPENSE ──────────────────────────────────────────────────────
    const result = await query(`
      INSERT INTO transactions (user_id, wallet_id, category_id, type, amount, description, payment_name, status, transaction_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id
    `, [userId, wallet_id, category_id, type, amount, encrypt(description), payment_name, status || 'completed', transaction_date || new Date()]);

    if (wallet_id) {
      const sign = type === 'income' ? '+' : '-';
      await query(`UPDATE wallets SET balance = balance ${sign} $1 WHERE id=$2 AND user_id=$3`, [amount, wallet_id, userId]);
    }

    const full = await query(`${BASE_SELECT} WHERE t.id=$1`, [result.rows[0].id]);
    recordBalanceSnapshot(userId);
    res.status(201).json({ success: true, data: decryptTx(full.rows[0]) });
  } catch (err) {
    console.error('createTransaction error:', err.message, '| column:', err.column, '| detail:', err.detail, '| constraint:', err.constraint);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Wallet balance effect of a stored transaction row (income +, expense −, transfer by direction).
const balanceDelta = r => {
  const amt = parseFloat(r.amount) || 0;
  if (r.type === 'income') return amt;
  if (r.type === 'expense') return -amt;
  if (r.type === 'transfer') return r.transfer_direction === 'in' ? amt : -amt;
  return 0;
};
const adjustWallet = (walletId, delta, userId) =>
  walletId && delta ? query('UPDATE wallets SET balance = balance + $1 WHERE id=$2 AND user_id=$3', [delta, walletId, userId]) : null;

// ── PUT /api/transactions/:id ────────────────────────────────────────────────
const update = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { wallet_id, category_id, type, amount, description, payment_name, status, transaction_date } = req.body;
    if (parseAmount(amount) === null) {
      return res.status(400).json({ success: false, message: 'Amount must be between ₹0.01 and ₹99,99,99,999' });
    }

    const foreign = await foreignIdProblem(userId, { wallets: [wallet_id], categories: [category_id] });
    if (foreign) return res.status(404).json({ success: false, message: foreign });

    // Don't allow editing transfer type via regular update
    const old = await query(
      "SELECT wallet_id, type, amount, transfer_direction FROM transactions WHERE id=$1 AND user_id=$2 AND type != 'transfer'",
      [req.params.id, userId]
    );
    const result = await query(`
      UPDATE transactions SET wallet_id=$1, category_id=$2, type=$3, amount=$4,
        description=$5, payment_name=$6, status=$7, transaction_date=$8, updated_at=NOW()
      WHERE id=$9 AND user_id=$10 AND type != 'transfer'
      RETURNING id
    `, [wallet_id, category_id, type, amount, encrypt(description), payment_name, status, transaction_date, req.params.id, userId]);

    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Transaction not found' });
    // Keep wallet balances in step with the edit: undo the old effect, apply the new one.
    if (old.rows.length) {
      await adjustWallet(old.rows[0].wallet_id, -balanceDelta(old.rows[0]), userId);
      await adjustWallet(wallet_id, balanceDelta({ type, amount }), userId);
    }
    const full = await query(`${BASE_SELECT} WHERE t.id=$1`, [result.rows[0].id]);
    recordBalanceSnapshot(userId);
    res.json({ success: true, data: decryptTx(full.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── DELETE /api/transactions/:id ─────────────────────────────────────────────
const remove = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Check if it's part of a transfer — delete both paired records
    const check = await query(
      'SELECT transfer_pair_id, type FROM transactions WHERE id=$1 AND user_id=$2',
      [req.params.id, userId]
    );
    if (!check.rows.length) return res.status(404).json({ success: false, message: 'Not found' });

    let removed;
    if (check.rows[0].type === 'transfer' && check.rows[0].transfer_pair_id) {
      removed = await query(
        'DELETE FROM transactions WHERE transfer_pair_id=$1 AND user_id=$2 RETURNING wallet_id, type, amount, transfer_direction',
        [check.rows[0].transfer_pair_id, userId]
      );
    } else {
      removed = await query(
        'DELETE FROM transactions WHERE id=$1 AND user_id=$2 RETURNING wallet_id, type, amount, transfer_direction',
        [req.params.id, userId]
      );
    }
    // Give the money back: reverse each deleted row's effect on its wallet.
    for (const r of removed.rows) await adjustWallet(r.wallet_id, -balanceDelta(r), userId);

    recordBalanceSnapshot(userId);
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, getById, create, update, remove };
