const { pool } = require('./index');

/* Idempotent, additive column guards so a deploy never runs ahead of the
   schema. Safe to run repeatedly (ADD COLUMN IF NOT EXISTS is a no-op when the
   column already exists). Runs once per process. */
let done = false;

async function ensureColumns() {
  if (done) return;
  done = true;
  const stmts = [
    `ALTER TABLE budgets    ADD COLUMN IF NOT EXISTS type VARCHAR(10) DEFAULT 'expense'`,
    `ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon VARCHAR(40)`,
    `ALTER TABLE wallets    ADD COLUMN IF NOT EXISTS statement_day INTEGER`,
    `ALTER TABLE wallets    ADD COLUMN IF NOT EXISTS payment_day INTEGER`,
  ];
  for (const sql of stmts) {
    try { await pool.query(sql); }
    catch (e) { console.error('ensureColumns:', e.message); }
  }
}

module.exports = ensureColumns;
