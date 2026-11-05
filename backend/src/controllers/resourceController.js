const { query } = require('../db');
const { encrypt, decryptRow } = require('../utils/crypto');
const { parseAmount, blankToNull } = require('../utils/validate');

const decryptWallet = row => decryptRow(row, ['name']);
const decryptGoal   = row => decryptRow(row, ['name']);

// ===== SAVING GOALS =====
const getAllGoals = async (req, res) => {
  try {
    const result = await query('SELECT * FROM saving_goals WHERE user_id=$1 ORDER BY created_at', [req.user.userId]);
    res.json({ success: true, data: result.rows.map(g => {
      const d = decryptGoal(g);
      return {
        ...d,
        target_amount:  parseFloat(d.target_amount),
        current_amount: parseFloat(d.current_amount),
        percentage: d.target_amount > 0 ? ((parseFloat(d.current_amount) / parseFloat(d.target_amount)) * 100).toFixed(1) : 0,
      };
    }) });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const validateGoal = ({ name, target_amount, current_amount, monthly_contribution }) => {
  if (!name || !String(name).trim()) return 'Please enter a goal name';
  if (parseAmount(target_amount) === null) return 'Please enter a valid target amount';
  if (current_amount !== undefined && current_amount !== '' && parseAmount(current_amount, { allowZero: true }) === null) return 'Please enter a valid saved amount';
  if (monthly_contribution !== undefined && monthly_contribution !== '' && parseAmount(monthly_contribution, { allowZero: true }) === null) return 'Please enter a valid monthly contribution';
  if (Number(current_amount) > Number(target_amount)) return "Saved amount can't exceed the target";
  return null;
};

const createGoal = async (req, res) => {
  try {
    const { name, target_amount, current_amount, emoji, color, target_date, monthly_contribution } = req.body;
    const err = validateGoal(req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    const result = await query(`
      INSERT INTO saving_goals (user_id, name, target_amount, current_amount, emoji, color, target_date, monthly_contribution)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [req.user.userId, encrypt(name.trim()), Number(target_amount), Number(current_amount) || 0, emoji || '🎯', color || '#6c5ce7', blankToNull(target_date), Number(monthly_contribution) || 0]);
    res.status(201).json({ success: true, data: decryptGoal(result.rows[0]) });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const updateGoal = async (req, res) => {
  try {
    const { name, target_amount, current_amount, emoji, color, target_date, monthly_contribution } = req.body;
    const err = validateGoal(req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    const result = await query(`
      UPDATE saving_goals SET name=$1, target_amount=$2, current_amount=$3, emoji=$4, color=$5,
        target_date=$6, monthly_contribution=$7, updated_at=NOW()
      WHERE id=$8 AND user_id=$9 RETURNING *
    `, [encrypt(name.trim()), Number(target_amount), Number(current_amount) || 0, emoji, color, blankToNull(target_date), Number(monthly_contribution) || 0, req.params.id, req.user.userId]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Goal not found' });
    res.json({ success: true, data: decryptGoal(result.rows[0]) });
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
    res.json({ success: true, data: result.rows.map(decryptWallet) });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const createWallet = async (req, res) => {
  try {
    const { name, type, last_four, balance, color, credit_limit, interest_rate, total_loan_amount, emi_amount, emi_day, due_date, start_date, statement_day, payment_day } = req.body;
    const result = await query(`
      INSERT INTO wallets (user_id, name, type, last_four, balance, color, credit_limit, interest_rate, total_loan_amount, emi_amount, emi_day, due_date, start_date, statement_day, payment_day)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
    `, [req.user.userId, encrypt(name), type, last_four, balance || 0, color || '#6c5ce7',
        credit_limit || null, interest_rate || null, total_loan_amount || null,
        emi_amount || null, emi_day || null, due_date || null, start_date || null,
        statement_day || null, payment_day || null]);
    res.status(201).json({ success: true, data: decryptWallet(result.rows[0]) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateWallet = async (req, res) => {
  try {
    const { name, type, last_four, balance, color, credit_limit, interest_rate, total_loan_amount, emi_amount, emi_day, due_date, start_date, statement_day, payment_day } = req.body;
    const result = await query(`
      UPDATE wallets SET name=$1, type=$2, last_four=$3, balance=$4, color=$5,
        credit_limit=$6, interest_rate=$7, total_loan_amount=$8, emi_amount=$9, emi_day=$10, due_date=$11, start_date=$12, statement_day=$13, payment_day=$14, updated_at=NOW()
      WHERE id=$15 AND user_id=$16 RETURNING *
    `, [encrypt(name), type, last_four, balance || 0, color || '#6c5ce7',
        credit_limit || null, interest_rate || null, total_loan_amount || null,
        emi_amount || null, emi_day || null, due_date || null, start_date || null,
        statement_day || null, payment_day || null,
        req.params.id, req.user.userId]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Wallet not found' });
    res.json({ success: true, data: decryptWallet(result.rows[0]) });
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
    const { name, type, emoji, color, icon } = req.body;
    if (!name || !type) return res.status(400).json({ success: false, message: 'Name and type are required' });
    const result = await query(`
      INSERT INTO categories (user_id, name, type, emoji, color, icon, is_default)
      VALUES ($1,$2,$3,$4,$5,$6,false) RETURNING *
    `, [req.user.userId, name.trim(), type, emoji || '📌', color || '#6c5ce7', icon || null]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const updateCategory = async (req, res) => {
  try {
    const { name, type, emoji, color, icon } = req.body;
    const result = await query(`
      UPDATE categories SET name=$1, type=$2, emoji=$3, color=$4, icon=$5
      WHERE id=$6 AND user_id=$7 AND is_default=false RETURNING *
    `, [name, type, emoji, color, icon || null, req.params.id, req.user.userId]);
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

// ===== CSV EXPORT =====
const exportCSV = async (req, res) => {
  try {
    const uid = req.user.userId;
    const { start_date, end_date } = req.query;

    let sql = `
      SELECT t.transaction_date, t.type, t.amount, t.payment_name, t.description,
             c.name AS category, w.name AS wallet, t.status
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN wallets w ON w.id = t.wallet_id
      WHERE t.user_id = $1
    `;
    const params = [uid];
    if (start_date) { params.push(start_date); sql += ` AND t.transaction_date >= $${params.length}`; }
    if (end_date)   { params.push(end_date);   sql += ` AND t.transaction_date <= $${params.length}`; }
    sql += ' ORDER BY t.transaction_date DESC';

    const result = await query(sql, params);

    const { decryptRow } = require('../utils/crypto');
    const rows = result.rows.map(r => {
      const dr = decryptRow(r, ['payment_name', 'description']);
      // wallet name may be encrypted too
      const dw = decryptRow({ name: dr.wallet }, ['name']);
      return { ...dr, wallet: dw.name };
    });

    const headers = ['Date', 'Type', 'Amount', 'Payment Name', 'Description', 'Category', 'Wallet', 'Status'];
    const escape = v => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csv = [
      headers.join(','),
      ...rows.map(r => [
        r.transaction_date ? new Date(r.transaction_date).toISOString().split('T')[0] : '',
        escape(r.type),
        escape(r.amount),
        escape(r.payment_name),
        escape(r.description),
        escape(r.category),
        escape(r.wallet),
        escape(r.status),
      ].join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tracksy-transactions-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('CSV export error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ===== WALLET RECONCILE =====
const reconcileWallet = async (req, res) => {
  try {
    const { actual_balance } = req.body;
    if (actual_balance === undefined || actual_balance === null) {
      return res.status(400).json({ success: false, message: 'actual_balance is required' });
    }

    // Get current wallet balance
    const walletRes = await query(
      'SELECT * FROM wallets WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    if (!walletRes.rows.length) return res.status(404).json({ success: false, message: 'Wallet not found' });

    const wallet = walletRes.rows[0];
    const currentBalance = parseFloat(wallet.balance || 0);
    const targetBalance  = parseFloat(actual_balance);
    const diff = targetBalance - currentBalance;

    if (Math.abs(diff) < 0.01) {
      return res.json({ success: true, message: 'Already balanced', diff: 0, wallet });
    }

    // Create an adjustment transaction
    const adjType = diff > 0 ? 'income' : 'expense';
    const adjAmt  = Math.abs(diff);
    const { encrypt } = require('../utils/crypto');

    await query(`
      INSERT INTO transactions (user_id, wallet_id, type, amount, payment_name, description, transaction_date, status)
      VALUES ($1,$2,$3,$4,$5,$6,NOW(),'completed')
    `, [req.user.userId, wallet.id, adjType, adjAmt, encrypt('Balance Adjustment'), encrypt('Manual reconciliation')]);

    // Update wallet balance
    await query('UPDATE wallets SET balance=$1, updated_at=NOW() WHERE id=$2', [targetBalance, wallet.id]);

    res.json({ success: true, message: 'Wallet reconciled', diff, adjusted_amount: adjAmt, adjustment_type: adjType });
  } catch (err) {
    console.error('Reconcile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ===== LIABILITY PAYMENT (loan / card repayment; interest vs principal) =====
// body: { amount, apply_to: 'principal'|'interest', from_wallet_id?, note?, accrue? }
const payLiability = async (req, res) => {
  try {
    const { encrypt } = require('../utils/crypto');
    const { amount, apply_to = 'interest', from_wallet_id, note, accrue } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ success: false, message: 'Enter a valid amount' });

    const wRes = await query('SELECT * FROM wallets WHERE id=$1 AND user_id=$2', [req.params.id, req.user.userId]);
    if (!wRes.rows.length) return res.status(404).json({ success: false, message: 'Liability not found' });
    const w = wRes.rows[0];

    // balance is stored NEGATIVE for liabilities (outstanding owed)
    let outstanding = Math.abs(parseFloat(w.balance || 0));
    let principal   = parseFloat(w.total_loan_amount || 0);

    // Optional: accrue interest up to now before applying payment (gold-loan style)
    if (accrue && w.interest_rate && w.start_date && principal > 0) {
      const start = new Date(w.start_date);
      const months = Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000*60*60*24*30.4375)));
      const accrued = principal * (parseFloat(w.interest_rate)/100/12) * months;
      // outstanding already reflects historic value; we only top-up if outstanding < principal+accrued isn't tracked — skip double counting
    }

    // Apply payment: reduces outstanding either way; PRINCIPAL also lowers future-interest base
    const payAmt = Math.min(amt, outstanding || amt);
    outstanding = Math.max(0, outstanding - payAmt);
    if (apply_to === 'principal') principal = Math.max(0, principal - payAmt);

    const newBalance = -outstanding; // keep negative sign for liability
    await query(
      'UPDATE wallets SET balance=$1, total_loan_amount=$2, updated_at=NOW() WHERE id=$3 AND user_id=$4',
      [newBalance, principal || null, w.id, req.user.userId]
    );

    // If paid from a source account, deduct there + log an expense transaction
    if (from_wallet_id) {
      await query('UPDATE wallets SET balance = balance - $1, updated_at=NOW() WHERE id=$2 AND user_id=$3',
        [payAmt, from_wallet_id, req.user.userId]);
      await query(`
        INSERT INTO transactions (user_id, wallet_id, type, amount, payment_name, description, transaction_date, status)
        VALUES ($1,$2,'expense',$3,$4,$5,NOW(),'completed')
      `, [req.user.userId, from_wallet_id, payAmt,
          encrypt(`${apply_to === 'principal' ? 'Principal' : 'Interest'} Payment`),
          encrypt(note || 'Loan repayment')]);
    }

    res.json({ success: true, message: 'Payment recorded', new_outstanding: outstanding, principal, applied: apply_to });
  } catch (err) {
    console.error('payLiability error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ===== NET WORTH SNAPSHOTS =====
const getNetWorthHistory = async (req, res) => {
  try {
    const uid = req.user.userId;
    // Get last 6 months of snapshots
    const result = await query(`
      SELECT snapshot_date, net_worth, total_assets, total_debt
      FROM net_worth_snapshots
      WHERE user_id = $1
        AND snapshot_date >= (CURRENT_DATE - INTERVAL '6 months')
      ORDER BY snapshot_date ASC
    `, [uid]);

    // If no snapshots exist, calculate on the fly from current wallet balances
    if (result.rows.length === 0) {
      const wallets = await query('SELECT type, balance FROM wallets WHERE user_id=$1', [uid]);
      const assetTypes = ['bank','cash','paypal','crypto','asset','other','gpay','phonepe','paytm','amazon_pay','mobikwik','jio_money','airtel_money','irctc'];
      const debtTypes  = ['visa','mastercard','loan','lending'];
      let totalAssets = 0, totalDebt = 0;
      wallets.rows.forEach(w => {
        const bal = parseFloat(w.balance || 0);
        if (assetTypes.includes(w.type)) totalAssets += Math.max(0, bal);
        else if (debtTypes.includes(w.type)) totalDebt += Math.abs(Math.min(0, bal));
      });
      return res.json({ success: true, data: [{
        snapshot_date: new Date().toISOString().split('T')[0],
        net_worth: totalAssets - totalDebt,
        total_assets: totalAssets,
        total_debt: totalDebt,
      }]});
    }

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Net worth history error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const saveNetWorthSnapshot = async (req, res) => {
  try {
    const uid = req.user.userId;
    const wallets = await query('SELECT type, balance FROM wallets WHERE user_id=$1', [uid]);
    const assetTypes = ['bank','cash','paypal','crypto','asset','other'];
    const debtTypes  = ['visa','mastercard','loan','lending'];
    let totalAssets = 0, totalDebt = 0;
    wallets.rows.forEach(w => {
      const bal = parseFloat(w.balance || 0);
      if (assetTypes.includes(w.type)) totalAssets += Math.max(0, bal);
      else if (debtTypes.includes(w.type)) totalDebt += Math.abs(Math.min(0, bal));
    });
    const netWorth = totalAssets - totalDebt;
    const today = new Date().toISOString().split('T')[0];

    await query(`
      INSERT INTO net_worth_snapshots (user_id, snapshot_date, net_worth, total_assets, total_debt)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (user_id, snapshot_date) DO UPDATE
        SET net_worth=$3, total_assets=$4, total_debt=$5
    `, [uid, today, netWorth, totalAssets, totalDebt]);

    res.json({ success: true, data: { snapshot_date: today, net_worth: netWorth, total_assets: totalAssets, total_debt: totalDebt } });
  } catch (err) {
    console.error('Save snapshot error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getAllGoals, createGoal, updateGoal, addFundsToGoal, deleteGoal,
  getAllWallets, createWallet, updateWallet, deleteWallet,
  getAllCategories, createCategory, updateCategory, deleteCategory,
  exportData, resetData,
  exportCSV, reconcileWallet, payLiability, getNetWorthHistory, saveNetWorthSnapshot,
};
