/* Sample / demo data.
   Loads a full year of realistic demo data for the signed-in user so they can
   see how every feature looks (accounts, credit card, loan, assets, lending,
   transactions, budgets, saving goals, recurring, net-worth history). Every row
   is tagged is_sample=true, so "Remove" deletes only demo rows and the user's
   real data is never touched. Challenges live in the browser (localStorage) and
   are seeded/cleared on the frontend. */

const { query, pool } = require('../db');

const SAMPLE_TABLES = ['transactions','budgets','saving_goals','recurring_transactions','net_worth_snapshots','wallets'];

/* Self-heal: the is_sample columns are added by migrate.js, but deployments
   don't auto-run migrations, so ensure they exist before any sample op. All
   IF NOT EXISTS, so this is idempotent and safe to run on every call. */
let columnsReady = false;
async function ensureColumns(client = { query }) {
  if (columnsReady) return;
  for (const t of SAMPLE_TABLES) {
    await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false`);
  }
  columnsReady = true;
}

/* yyyy-mm-dd for a date N days before today */
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };
const monthsAgoDate = (m, day = 1) => { const d = new Date(); d.setMonth(d.getMonth() - m); d.setDate(day); return d.toISOString().split('T')[0]; };
const rand = (min, max) => Math.round(min + Math.random() * (max - min));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* GET /api/data/sample/status → { loaded, counts } */
const status = async (req, res) => {
  try {
    const uid = req.user.userId;
    await ensureColumns();
    const r = await query('SELECT COUNT(*)::int AS n FROM transactions WHERE user_id=$1 AND is_sample=true', [uid]);
    res.json({ success: true, loaded: r.rows[0].n > 0, transactions: r.rows[0].n });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
};

/* DELETE /api/data/sample → remove every demo row for this user */
const remove = async (req, res) => {
  try {
    const uid = req.user.userId;
    await ensureColumns();
    for (const t of SAMPLE_TABLES) {
      await query(`DELETE FROM ${t} WHERE user_id=$1 AND is_sample=true`, [uid]);
    }
    res.json({ success: true, message: 'Sample data removed' });
  } catch (e) { console.error('[sample/remove]', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
};

/* POST /api/data/sample → load a fresh year of demo data (replaces any existing demo data) */
const load = async (req, res) => {
  const uid = req.user.userId;
  const client = await pool.connect();
  try {
    await ensureColumns(client);
    await client.query('BEGIN');

    // Start clean so repeated loads don't stack up.
    for (const t of SAMPLE_TABLES) {
      await client.query(`DELETE FROM ${t} WHERE user_id=$1 AND is_sample=true`, [uid]);
    }

    // Map default category names → ids (global defaults, shared by all users).
    const cats = await client.query(`SELECT id, name, type FROM categories WHERE is_default=true`);
    const catId = (name) => (cats.rows.find(c => c.name === name) || {}).id || null;

    // ── Accounts (covers bank, cash, credit card, loan, asset, lending) ──
    const wallets = [
      { name:'HDFC Savings',     type:'bank',   last_four:'6590', balance: 86500,   color:'#004C8F' },
      { name:'Cash Wallet',      type:'cash',   last_four:null,   balance: 4200,    color:'#16A34A' },
      { name:'HDFC Credit Card', type:'visa',   last_four:'4521', balance: -18450,  color:'#1A1F71', credit_limit:150000, interest_rate:42, statement_day:5, payment_day:22 },
      { name:'Home Loan',        type:'loan',   last_four:null,   balance: -1845000,color:'#DC2626', total_loan_amount:2500000, emi_amount:21500, emi_day:5, interest_rate:8.6, due_date: daysAgo(-5) },
      { name:'Gold Investment',  type:'asset',  last_four:null,   balance: 128000,  color:'#F59E0B' },
      { name:'Lent to Ramesh',   type:'lending',last_four:null,   balance: 15000,   color:'#8B5CF6' },
    ];
    const walletIds = {};
    for (const w of wallets) {
      const r = await client.query(
        `INSERT INTO wallets (user_id, name, type, last_four, balance, color, credit_limit, interest_rate, total_loan_amount, emi_amount, emi_day, due_date, statement_day, payment_day, is_sample)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true) RETURNING id`,
        [uid, w.name, w.type, w.last_four, w.balance, w.color, w.credit_limit||null, w.interest_rate||null,
         w.total_loan_amount||null, w.emi_amount||null, w.emi_day||null, w.due_date||null, w.statement_day||null, w.payment_day||null]
      );
      walletIds[w.name] = r.rows[0].id;
    }
    const bank = walletIds['HDFC Savings'];
    const cash = walletIds['Cash Wallet'];
    const card = walletIds['HDFC Credit Card'];

    // ── Transactions: 12 months ──
    const tx = []; // [wallet, cat, type, amount, desc, payName, date]
    for (let m = 11; m >= 0; m--) {
      // Monthly salary (income)
      tx.push([bank, catId('Salary'), 'income', rand(64000, 66000), 'Monthly Salary', 'Acme Corp Payroll', monthsAgoDate(m, 1)]);
      // Rent
      tx.push([bank, catId('Bills & Utilities'), 'expense', 18000, 'House Rent', 'Landlord', monthsAgoDate(m, 3)]);
      // Utilities
      tx.push([bank, catId('Bills & Utilities'), 'expense', rand(1200, 2600), pick(['Electricity Bill','Water Bill','Broadband']), 'BESCOM / ACT', monthsAgoDate(m, 8)]);
      tx.push([card, catId('Bills & Utilities'), 'expense', 649, 'Netflix', 'Netflix', monthsAgoDate(m, 12)]);
      tx.push([card, catId('Bills & Utilities'), 'expense', rand(399, 799), 'Mobile Recharge', 'Jio', monthsAgoDate(m, 15)]);
      // Groceries (2-3 / month)
      for (let g = 0; g < rand(2, 3); g++)
        tx.push([pick([bank, card]), catId('Shopping'), 'expense', rand(800, 3200), pick(['BigBasket','DMart','Reliance Fresh']), 'Groceries', monthsAgoDate(m, rand(4, 27))]);
      // Food & dining (4-8 / month)
      for (let f = 0; f < rand(4, 8); f++)
        tx.push([pick([cash, card, bank]), catId('Food & Dining'), 'expense', rand(180, 950), pick(['Swiggy','Zomato','Dominos','Cafe Coffee Day','Local Restaurant']), 'Food', monthsAgoDate(m, rand(2, 28))]);
      // Transport (3-6 / month)
      for (let t = 0; t < rand(3, 6); t++)
        tx.push([pick([cash, bank]), catId('Transport'), 'expense', rand(60, 650), pick(['Uber','Ola','Metro Card','Petrol']), 'Transport', monthsAgoDate(m, rand(2, 28))]);
      // Shopping (1-2 / month)
      for (let s = 0; s < rand(1, 2); s++)
        tx.push([card, catId('Shopping'), 'expense', rand(700, 6500), pick(['Amazon','Flipkart','Myntra','Decathlon']), 'Shopping', monthsAgoDate(m, rand(5, 26))]);
      // Entertainment
      tx.push([pick([card, cash]), catId('Entertainment'), 'expense', rand(250, 1200), pick(['PVR Cinemas','BookMyShow','Spotify']), 'Entertainment', monthsAgoDate(m, rand(6, 24))]);
      // Health (occasional)
      if (Math.random() < 0.6)
        tx.push([bank, catId('Health'), 'expense', rand(300, 2500), pick(['Apollo Pharmacy','Practo','Lab Test']), 'Health', monthsAgoDate(m, rand(6, 24))]);
      // EMI payment
      tx.push([bank, catId('Bills & Utilities'), 'expense', 21500, 'Home Loan EMI', 'HDFC Home Loan', monthsAgoDate(m, 5)]);
      // Occasional extra income (freelance)
      if (Math.random() < 0.4)
        tx.push([bank, catId('Freelance'), 'income', rand(5000, 18000), 'Freelance Project', 'Upwork', monthsAgoDate(m, rand(10, 25))]);
    }

    // Bulk insert transactions
    for (const [wallet, category, type, amount, description, payment_name, date] of tx) {
      await client.query(
        `INSERT INTO transactions (user_id, wallet_id, category_id, type, amount, description, payment_name, status, transaction_date, is_sample)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8,true)`,
        [uid, wallet, category, type, amount, description, payment_name, date]
      );
    }

    // ── Budgets ──
    const budgets = [
      ['Food Budget',      'Food & Dining',     8000],
      ['Transport Budget', 'Transport',         3000],
      ['Shopping Budget',  'Shopping',          5000],
      ['Entertainment',    'Entertainment',     2000],
      ['Utilities',        'Bills & Utilities', 4000],
    ];
    for (const [name, cat, amount] of budgets) {
      await client.query(
        `INSERT INTO budgets (user_id, category_id, name, amount, period, start_date, type, is_sample)
         VALUES ($1,$2,$3,$4,'monthly',$5,'expense',true)`,
        [uid, catId(cat), name, amount, monthsAgoDate(0, 1)]
      );
    }

    // ── Saving Goals ──
    const goals = [
      ['Emergency Fund', 150000, 92000, '🛡️', '#22C55E'],
      ['Goa Vacation',    60000, 38000, '✈️', '#3B82F6'],
      ['New iPhone',     120000, 45000, '📱', '#8B5CF6'],
    ];
    for (const [name, target, current, emoji, color] of goals) {
      await client.query(
        `INSERT INTO saving_goals (user_id, name, target_amount, current_amount, emoji, color, target_date, monthly_contribution, is_sample)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
        [uid, name, target, current, emoji, color, monthsAgoDate(-6, 1), 8000]
      );
    }

    // ── Recurring ──
    const recurring = [
      ['income',  65000, 'Monthly Salary', 'Salary',            'monthly'],
      ['expense', 18000, 'House Rent',      'Bills & Utilities', 'monthly'],
      ['expense',   649, 'Netflix',         'Bills & Utilities', 'monthly'],
      ['expense',  1200, 'Gym Membership',  'Health',            'monthly'],
    ];
    for (const [type, amount, payment_name, cat, frequency] of recurring) {
      await client.query(
        `INSERT INTO recurring_transactions (user_id, wallet_id, category_id, type, amount, payment_name, frequency, start_date, next_run, is_active, is_sample)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,true)`,
        [uid, bank, catId(cat), type, amount, payment_name, frequency, monthsAgoDate(11, 1), monthsAgoDate(-1, 1)]
      );
    }

    // ── Net-worth history (12 monthly snapshots, trending up) ──
    let nw = 180000;
    for (let m = 11; m >= 0; m--) {
      nw += rand(6000, 22000);
      const assets = nw + 1845000; // debt added back for gross assets
      await client.query(
        `INSERT INTO net_worth_snapshots (user_id, snapshot_date, net_worth, total_assets, total_debt, is_sample)
         VALUES ($1,$2,$3,$4,$5,true)
         ON CONFLICT (user_id, snapshot_date) DO NOTHING`,
        [uid, monthsAgoDate(m, 1), nw, assets, 1845000 - (11 - m) * 18000]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Sample data loaded', transactions: tx.length });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[sample/load]', e.message);
    res.status(500).json({ success: false, message: 'Failed to load sample data: ' + e.message });
  } finally {
    client.release();
  }
};

module.exports = { status, load, remove };
