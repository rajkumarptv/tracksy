const { pool } = require('./index');

/* Idempotent, additive column guards so a deploy never runs ahead of the
   schema. Safe to run repeatedly (ADD COLUMN IF NOT EXISTS is a no-op when the
   column already exists). Runs once per process. */
let done = false;

async function ensureColumns() {
  if (done) return;
  done = true;
  const stmts = [
    `ALTER TABLE budgets      ADD COLUMN IF NOT EXISTS type VARCHAR(10) DEFAULT 'expense'`,
    `ALTER TABLE categories   ADD COLUMN IF NOT EXISTS icon VARCHAR(40)`,
    `ALTER TABLE wallets      ADD COLUMN IF NOT EXISTS statement_day INTEGER`,
    `ALTER TABLE wallets      ADD COLUMN IF NOT EXISTS payment_day INTEGER`,
    `ALTER TABLE wallets      ADD COLUMN IF NOT EXISTS start_date DATE`,
    // Transfers rely on these — missing columns make transfers 500
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_pair_id UUID`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_direction VARCHAR(10)`,
    // Widen in case an older deploy created it too small ('out' is 3 chars)
    `ALTER TABLE transactions ALTER COLUMN transfer_direction TYPE VARCHAR(10)`,
    // Drop any legacy length CHECK that could reject values
    `ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_transfer_direction_check`,
    // Encrypted values can exceed VARCHAR(255) — store as TEXT
    `ALTER TABLE transactions ALTER COLUMN description TYPE TEXT`,
    `ALTER TABLE transactions ALTER COLUMN payment_name TYPE TEXT`,
  ];
  for (const sql of stmts) {
    try { await pool.query(sql); }
    catch (e) { console.error('ensureColumns:', e.message); }
  }
}

module.exports = ensureColumns;
