require('dotenv').config();
const { pool } = require('./index');

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🔄 Running migrations...');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        currency VARCHAR(10) DEFAULT 'USD',
        language VARCHAR(10) DEFAULT 'en',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Notification preferences
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        transaction_alerts BOOLEAN DEFAULT true,
        budget_warnings BOOLEAN DEFAULT true,
        weekly_summary BOOLEAN DEFAULT false,
        goal_milestones BOOLEAN DEFAULT true,
        UNIQUE(user_id)
      );
    `);

    // Wallets / Payment methods
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('visa','mastercard','paypal','bank','cash','crypto','other')),
        last_four VARCHAR(4),
        balance NUMERIC(15,2) DEFAULT 0.00,
        color VARCHAR(20) DEFAULT '#6c5ce7',
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Categories
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('income','expense','both')),
        emoji VARCHAR(10) DEFAULT '📌',
        color VARCHAR(20) DEFAULT '#6c5ce7',
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Transactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
        category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('income','expense','transfer')),
        amount NUMERIC(15,2) NOT NULL,
        description VARCHAR(255),
        payment_name VARCHAR(255),
        status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed','pending','failed')),
        transaction_date TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Budgets
    await client.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        period VARCHAR(20) DEFAULT 'monthly' CHECK (period IN ('weekly','monthly','yearly')),
        start_date DATE NOT NULL,
        end_date DATE,
        emoji VARCHAR(10) DEFAULT '📌',
        color VARCHAR(20) DEFAULT '#6c5ce7',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Saving Goals
    await client.query(`
      CREATE TABLE IF NOT EXISTS saving_goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        target_amount NUMERIC(15,2) NOT NULL,
        current_amount NUMERIC(15,2) DEFAULT 0.00,
        emoji VARCHAR(10) DEFAULT '🎯',
        color VARCHAR(20) DEFAULT '#6c5ce7',
        target_date DATE,
        monthly_contribution NUMERIC(15,2) DEFAULT 0.00,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Wallet extra columns (debt tracking fields)
    await client.query(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15,2)`);
    await client.query(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(5,2)`);
    await client.query(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS total_loan_amount NUMERIC(15,2)`);
    await client.query(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS emi_amount NUMERIC(15,2)`);
    await client.query(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS emi_day INTEGER`);
    await client.query(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS due_date DATE`);

    // Drop old type constraint and add updated one with debt/asset types
    await client.query(`ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_type_check`);
    await client.query(`ALTER TABLE wallets ADD CONSTRAINT wallets_type_check CHECK (type IN (
      'visa','mastercard','paypal','bank','cash','crypto','other',
      'loan','asset','lending',
      'gpay','phonepe','paytm','amazon_pay','mobikwik','jio_money','airtel_money','irctc'
    ))`);

    // Transfer support — pair ID + direction flag
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_pair_id UUID`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_direction VARCHAR(3) CHECK (transfer_direction IN ('out','in'))`);

    // WhatsApp integration
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(20) UNIQUE`);

    // OAuth & Premium
    await client.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(20)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(100)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id) WHERE oauth_provider IS NOT NULL`);

    // Admin & activity tracking
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`);

    // ── Family Budget (Head-of-Household model) ──────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS families (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(120) NOT NULL,
        primary_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Unique join code so members can opt-in themselves (consent-based)
    await client.query(`ALTER TABLE families ADD COLUMN IF NOT EXISTS family_code VARCHAR(10) UNIQUE`);
    // Visibility: 'head_only' = only primary sees members | 'shared' = everyone sees everyone
    await client.query(`ALTER TABLE families ADD COLUMN IF NOT EXISTS share_mode VARCHAR(20) DEFAULT 'head_only'`);

    // ── Gmail auto-import ────────────────────────────────────────────────
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_connected BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_sync_enabled BOOLEAN DEFAULT true`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_last_sync TIMESTAMPTZ`);
    // Idempotency: store the Gmail message id (or UPI ref) so we never double-import
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS external_id VARCHAR(255)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_external ON transactions(user_id, external_id) WHERE external_id IS NOT NULL`);
    // Link users to a family + role: 'primary' (head) or 'member'
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS family_role VARCHAR(10)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_family ON users(family_id) WHERE family_id IS NOT NULL`);

    // Recurring transactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
        category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('income','expense')),
        amount NUMERIC(15,2) NOT NULL,
        payment_name VARCHAR(255) NOT NULL,
        description VARCHAR(255),
        frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
        start_date DATE NOT NULL,
        end_date DATE,
        next_run DATE NOT NULL,
        last_run DATE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_transactions(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_recurring_next ON recurring_transactions(next_run) WHERE is_active=true;`);

    // Net worth snapshots (for history chart)
    await client.query(`
      CREATE TABLE IF NOT EXISTS net_worth_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        snapshot_date DATE NOT NULL,
        net_worth NUMERIC(15,2) NOT NULL,
        total_assets NUMERIC(15,2) DEFAULT 0,
        total_debt NUMERIC(15,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, snapshot_date)
      );
    `);

    // Indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_goals_user_id ON saving_goals(user_id);`);

    // Unique index to prevent duplicate default categories
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_default_name_type
      ON categories (name, type)
      WHERE is_default = true
    `);

    // Seed default categories (uses ON CONFLICT on the unique index)
    const defaultCategories = [
      { name:'Food & Dining',         type:'expense', emoji:'🍔', color:'#FF5B5B' },
      { name:'Transport',             type:'expense', emoji:'🚗', color:'#5B8CFF' },
      { name:'Shopping',              type:'expense', emoji:'🛍️', color:'#FFB84D' },
      { name:'Bills & Utilities',     type:'expense', emoji:'🏠', color:'#6C63FF' },
      { name:'Health',                type:'expense', emoji:'💊', color:'#37D67A' },
      { name:'Entertainment',         type:'expense', emoji:'🎬', color:'#A29BFE' },
      { name:'Education',             type:'expense', emoji:'📚', color:'#00CEC9' },
      { name:'Travel',                type:'expense', emoji:'✈️', color:'#74b9ff' },
      { name:'Credit Card Interest',  type:'expense', emoji:'💳', color:'#FF5B5B' },
      { name:'Finance Charges',       type:'expense', emoji:'📊', color:'#d63031' },
      { name:'Salary',                type:'income',  emoji:'💼', color:'#37D67A' },
      { name:'Freelance',             type:'income',  emoji:'💻', color:'#00CEC9' },
      { name:'Business',              type:'income',  emoji:'🏢', color:'#6C63FF' },
      { name:'Investment',            type:'income',  emoji:'📈', color:'#FFB84D' },
      { name:'Other Income',          type:'income',  emoji:'💰', color:'#A29BFE' },
    ];
    for (const cat of defaultCategories) {
      await client.query(`
        INSERT INTO categories (name, type, emoji, color, is_default)
        VALUES ($1,$2,$3,$4,true)
        ON CONFLICT (name, type) WHERE is_default = true DO UPDATE
          SET emoji=$3, color=$4
      `, [cat.name, cat.type, cat.emoji, cat.color]);
    }

    // Updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    for (const table of ['users','wallets','transactions','budgets','saving_goals']) {
      await client.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);
    }

    await client.query('COMMIT');
    console.log('✅ Migrations completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate().catch(() => process.exit(1));
