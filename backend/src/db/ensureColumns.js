const { pool } = require('./index');

/* Idempotent, additive column guards so a deploy never runs ahead of the
   schema. Safe to run repeatedly (ADD COLUMN IF NOT EXISTS is a no-op when the
   column already exists). Runs once per process. */
let done = false;

async function ensureColumns() {
  if (done) return;
  done = true;
  const stmts = [
    // OAuth (Google/Facebook) login needs these on users — else the callback 500s
    `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(20)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(100)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ`,
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
    // Daily balance snapshots for historical graph/analytics
    `CREATE TABLE IF NOT EXISTS balance_snapshots (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       snapshot_date DATE NOT NULL,
       spendable_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
       total_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       UNIQUE(user_id, snapshot_date)
     )`,
    `CREATE TABLE IF NOT EXISTS transaction_bills (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       original_name TEXT NOT NULL,
       file_name TEXT NOT NULL,
       mime_type VARCHAR(150) NOT NULL,
       file_size BIGINT,
       created_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    // Gmail sync was removed — drop any stored Google refresh tokens so none linger.
    `UPDATE users SET gmail_refresh_token = NULL, gmail_connected = false WHERE gmail_refresh_token IS NOT NULL OR gmail_connected = true`,
  ];
  for (const sql of stmts) {
    try { await pool.query(sql); }
    catch (e) { console.error('ensureColumns:', e.message); }
  }
}

module.exports = ensureColumns;
