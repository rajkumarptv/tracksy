const { query } = require('../db');

const BASE_SELECT = `
  SELECT t.id, t.type, t.amount, t.description, t.payment_name, t.status,
         t.transaction_date, t.created_at,
         w.name AS wallet_name, w.type AS wallet_type, w.last_four,
         c.name AS category_name, c.emoji AS category_emoji, c.color AS category_color,
         c.id AS category_id, w.id AS wallet_id
  FROM transactions t
  LEFT JOIN wallets w ON t.wallet_id = w.id
  LEFT JOIN categories c ON t.category_id = c.id
`;

// GET /api/transactions
const getAll = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type, category_id, wallet_id, status, start_date, end_date, search, page = 1, limit = 20 } = req.query;

    let conditions = ['t.user_id = $1'];
    let params = [userId];
    let idx = 2;

    if (type && type !== 'all') { conditions.push(`t.type = $${idx++}`); params.push(type); }
    if (category_id) { conditions.push(`t.category_id = $${idx++}`); params.push(category_id); }
    if (wallet_id) { conditions.push(`t.wallet_id = $${idx++}`); params.push(wallet_id); }
    if (status) { conditions.push(`t.status = $${idx++}`); params.push(status); }
    if (start_date) { conditions.push(`t.transaction_date >= $${idx++}`); params.push(start_date); }
    if (end_date) { conditions.push(`t.transaction_date <= $${idx++}`); params.push(end_date); }
    if (search) { conditions.push(`(t.description ILIKE $${idx} OR t.payment_name ILIKE $${idx})`); params.push(`%${search}%`); idx++; }

    const where = 'WHERE ' + conditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [dataRes, countRes] = await Promise.all([
      query(`${BASE_SELECT} ${where} ORDER BY t.transaction_date DESC LIMIT $${idx} OFFSET $${idx+1}`,
        [...params, parseInt(limit), offset]),
      query(`SELECT COUNT(*) FROM transactions t ${where}`, params)
    ]);

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(parseInt(countRes.rows[0].count) / parseInt(limit))
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/transactions/:id
const getById = async (req, res) => {
  try {
    const result = await query(`${BASE_SELECT} WHERE t.id=$1 AND t.user_id=$2`, [req.params.id, req.user.userId]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Transaction not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/transactions
const create = async (req, res) => {
  try {
    const { wallet_id, category_id, type, amount, description, payment_name, status, transaction_date } = req.body;
    const result = await query(`
      INSERT INTO transactions (user_id, wallet_id, category_id, type, amount, description, payment_name, status, transaction_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id
    `, [req.user.userId, wallet_id, category_id, type, amount, description, payment_name, status || 'completed', transaction_date || new Date()]);

    // Update wallet balance
    if (wallet_id) {
      const sign = type === 'income' ? '+' : '-';
      await query(`UPDATE wallets SET balance = balance ${sign} $1 WHERE id=$2 AND user_id=$3`, [amount, wallet_id, req.user.userId]);
    }

    const full = await query(`${BASE_SELECT} WHERE t.id=$1`, [result.rows[0].id]);
    res.status(201).json({ success: true, data: full.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/transactions/:id
const update = async (req, res) => {
  try {
    const { wallet_id, category_id, type, amount, description, payment_name, status, transaction_date } = req.body;
    const result = await query(`
      UPDATE transactions SET wallet_id=$1, category_id=$2, type=$3, amount=$4,
        description=$5, payment_name=$6, status=$7, transaction_date=$8, updated_at=NOW()
      WHERE id=$9 AND user_id=$10
      RETURNING id
    `, [wallet_id, category_id, type, amount, description, payment_name, status, transaction_date, req.params.id, req.user.userId]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Transaction not found' });
    const full = await query(`${BASE_SELECT} WHERE t.id=$1`, [result.rows[0].id]);
    res.json({ success: true, data: full.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/transactions/:id
const remove = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM transactions WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.user.userId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Transaction not found' });
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, getById, create, update, remove };
