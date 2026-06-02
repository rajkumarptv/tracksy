const { query } = require('../db');

// ===== SAVING GOALS =====
const getAllGoals = async (req, res) => {
  try {
    const result = await query('SELECT * FROM saving_goals WHERE user_id=$1 ORDER BY created_at', [req.user.userId]);
    res.json({ success: true, data: result.rows.map(g => ({
      ...g,
      target_amount: parseFloat(g.target_amount),
      current_amount: parseFloat(g.current_amount),
      percentage: g.target_amount > 0 ? ((parseFloat(g.current_amount) / parseFloat(g.target_amount)) * 100).toFixed(1) : 0
    })) });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const createGoal = async (req, res) => {
  try {
    const { name, target_amount, current_amount, emoji, color, target_date, monthly_contribution } = req.body;
    const result = await query(`
      INSERT INTO saving_goals (user_id, name, target_amount, current_amount, emoji, color, target_date, monthly_contribution)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [req.user.userId, name, target_amount, current_amount || 0, emoji || '🎯', color || '#6c5ce7', target_date, monthly_contribution || 0]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const updateGoal = async (req, res) => {
  try {
    const { name, target_amount, current_amount, emoji, color, target_date, monthly_contribution } = req.body;
    const result = await query(`
      UPDATE saving_goals SET name=$1, target_amount=$2, current_amount=$3, emoji=$4, color=$5,
        target_date=$6, monthly_contribution=$7, updated_at=NOW()
      WHERE id=$8 AND user_id=$9 RETURNING *
    `, [name, target_amount, current_amount, emoji, color, target_date, monthly_contribution, req.params.id, req.user.userId]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Goal not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const addFundsToGoal = async (req, res) => {
  try {
    const { amount } = req.body;
    const result = await query(`
      UPDATE saving_goals SET current_amount = LEAST(current_amount + $1, target_amount), updated_at=NOW()
      WHERE id=$2 AND user_id=$3 RETURNING *
    `, [amount, req.params.id, req.user.userId]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Goal not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const deleteGoal = async (req, res) => {
  try {
    const result = await query('DELETE FROM saving_goals WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.user.userId]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Goal not found' });
    res.json({ success: true, message: 'Goal deleted' });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

// ===== WALLETS =====
const getAllWallets = async (req, res) => {
  try {
    const result = await query('SELECT * FROM wallets WHERE user_id=$1 ORDER BY is_default DESC, created_at', [req.user.userId]);
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const createWallet = async (req, res) => {
  try {
    const { name, type, last_four, balance, color, credit_limit, interest_rate, total_loan_amount, emi_amount, emi_day, due_date } = req.body;
    const result = await query(`
      INSERT INTO wallets (user_id, name, type, last_four, balance, color, credit_limit, interest_rate, total_loan_amount, emi_amount, emi_day, due_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [req.user.userId, name, type, last_four, balance || 0, color || '#6c5ce7',
        credit_limit || null, interest_rate || null, total_loan_amount || null,
        emi_amount || null, emi_day || null, due_date || null]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateWallet = async (req, res) => {
  try {
    const { name, type, last_four, balance, color, credit_limit, interest_rate, total_loan_amount, emi_amount, emi_day, due_date } = req.body;
    const result = await query(`
      UPDATE wallets SET name=$1, type=$2, last_four=$3, balance=$4, color=$5,
        credit_limit=$6, interest_rate=$7, total_loan_amount=$8, emi_amount=$9, emi_day=$10, due_date=$11, updated_at=NOW()
      WHERE id=$12 AND user_id=$13 RETURNING *
    `, [name, type, last_four, balance || 0, color || '#6c5ce7',
        credit_limit || null, interest_rate || null, total_loan_amount || null,
        emi_amount || null, emi_day || null, due_date || null,
        req.params.id, req.user.userId]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Wallet not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteWallet = async (req, res) => {
  try {
    const result = await query('DELETE FROM wallets WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.user.userId]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Wallet not found' });
    res.json({ success: true, message: 'Wallet deleted' });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

// ===== CATEGORIES =====
const getAllCategories = async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM categories WHERE user_id=$1 OR is_default=true ORDER BY is_default DESC, type, name',
      [req.user.userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const createCategory = async (req, res) => {
  try {
    const { name, type, emoji, color } = req.body;
    if (!name || !type) return res.status(400).json({ success: false, message: 'Name and type are required' });
    const result = await query(`
      INSERT INTO categories (user_id, name, type, emoji, color, is_default)
      VALUES ($1,$2,$3,$4,$5,false) RETURNING *
    `, [req.user.userId, name.trim(), type, emoji || '📌', color || '#6c5ce7']);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const updateCategory = async (req, res) => {
  try {
    const { name, type, emoji, color } = req.body;
    const result = await query(`
      UPDATE categories SET name=$1, type=$2, emoji=$3, color=$4
      WHERE id=$5 AND user_id=$6 AND is_default=false RETURNING *
    `, [name, type, emoji, color, req.params.id, req.user.userId]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Category not found or cannot edit default categories' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const deleteCategory = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM categories WHERE id=$1 AND user_id=$2 AND is_default=false RETURNING id',
      [req.params.id, req.user.userId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Category not found or cannot delete default categories' });
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

// ===== DATA MANAGEMENT =====
const exportData = async (req, res) => {
  try {
    const uid = req.user.userId;
    const [wallets, transactions, budgets, goals, categories] = await Promise.all([
      query('SELECT * FROM wallets WHERE user_id=$1', [uid]),
      query('SELECT * FROM transactions WHERE user_id=$1 ORDER BY transaction_date DESC', [uid]),
      query('SELECT * FROM budgets WHERE user_id=$1', [uid]),
      query('SELECT * FROM saving_goals WHERE user_id=$1', [uid]),
      query('SELECT * FROM categories WHERE user_id=$1 AND is_default=false', [uid]),
    ]);
    res.json({ success: true, data: {
      exported_at: new Date().toISOString(),
      wallets: wallets.rows,
      transactions: transactions.rows,
      budgets: budgets.rows,
      goals: goals.rows,
      categories: categories.rows,
    }});
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const resetData = async (req, res) => {
  try {
    const uid = req.user.userId;
    const { scope } = req.body;
    if (scope === 'transactions') {
      await query('DELETE FROM transactions WHERE user_id=$1', [uid]);
    } else if (scope === 'all') {
      await query('DELETE FROM transactions WHERE user_id=$1', [uid]);
      await query('DELETE FROM budgets WHERE user_id=$1', [uid]);
      await query('DELETE FROM saving_goals WHERE user_id=$1', [uid]);
      await query('DELETE FROM categories WHERE user_id=$1 AND is_default=false', [uid]);
      await query('DELETE FROM wallets WHERE user_id=$1', [uid]);
    } else if (scope === 'budgets') {
      await query('DELETE FROM budgets WHERE user_id=$1', [uid]);
    } else if (scope === 'goals') {
      await query('DELETE FROM saving_goals WHERE user_id=$1', [uid]);
    }
    res.json({ success: true, message: `${scope} data reset successfully` });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

module.exports = {
  getAllGoals, createGoal, updateGoal, addFundsToGoal, deleteGoal,
  getAllWallets, createWallet, updateWallet, deleteWallet,
  getAllCategories, createCategory, updateCategory, deleteCategory,
  exportData, resetData,
};
