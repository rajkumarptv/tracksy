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
    await client.query(`ALTER TABLE wallets ADD CONSTRAINT wallets_type_check CHECK (type IN ('visa','mastercard','paypal','bank','cash','crypto','other','loan','asset','lending'))`);

    // Indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_goals_user_id ON saving_goals(user_id);`);

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
