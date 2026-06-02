require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./index');

const seed = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🌱 Seeding database...');

    // Truncate in order
    await client.query(`TRUNCATE saving_goals, budgets, transactions, categories, wallets, notification_preferences, users RESTART IDENTITY CASCADE`);

    // Create demo user
    const passwordHash = await bcrypt.hash('password123', 10);
    const userRes = await client.query(`
      INSERT INTO users (first_name, last_name, email, password_hash, currency, language)
      VALUES ('Adaline', 'Lively', 'adaline@tracksy.com', $1, 'USD', 'en')
      RETURNING id
    `, [passwordHash]);
    const userId = userRes.rows[0].id;

    // Notification prefs
    await client.query(`INSERT INTO notification_preferences (user_id) VALUES ($1)`, [userId]);

    // Wallets
    const walletsRes = await client.query(`
      INSERT INTO wallets (user_id, name, type, last_four, balance, color, is_default) VALUES
        ($1, 'VISA Card', 'visa', '3254', 8420.00, '#6c5ce7', true),
        ($1, 'Mastercard', 'mastercard', '2154', 3280.00, '#2d3436', false),
        ($1, 'PayPal', 'paypal', NULL, 4000.00, '#00b894', false)
      RETURNING id, name
    `, [userId]);
    const [visaId, masterId, paypalId] = walletsRes.rows.map(r => r.id);

    // Default categories
    const catRes = await client.query(`
      INSERT INTO categories (user_id, name, type, emoji, color, is_default) VALUES
        ($1, 'Salary', 'income', '💼', '#00b894', true),
        ($1, 'Freelance', 'income', '💻', '#6c5ce7', true),
        ($1, 'Investment', 'income', '📈', '#74b9ff', true),
        ($1, 'Cashback', 'income', '💰', '#fdcb6e', true),
        ($1, 'Refund', 'income', '🔁', '#55efc4', true),
        ($1, 'Money Transfer In', 'income', '↗', '#a29bfe', true),
        ($1, 'Cafe & Restaurants', 'expense', '☕', '#e17055', true),
        ($1, 'Food & Groceries', 'expense', '🛒', '#00b894', true),
        ($1, 'Shopping', 'expense', '🛍', '#fd79a8', true),
        ($1, 'Subscription', 'expense', '📱', '#6c5ce7', true),
        ($1, 'Transport', 'expense', '🚗', '#74b9ff', true),
        ($1, 'Health & Beauty', 'expense', '💄', '#fd79a8', true),
        ($1, 'Traveling', 'expense', '✈️', '#fdcb6e', true),
        ($1, 'Entertainment', 'expense', '🎬', '#a29bfe', true),
        ($1, 'Rent', 'expense', '🏠', '#636e72', true),
        ($1, 'Education', 'expense', '📚', '#0984e3', true)
      RETURNING id, name
    `, [userId]);

    const getCatId = (name) => catRes.rows.find(c => c.name === name)?.id;

    // Transactions for June–July 2024
    const transactions = [
      // INCOME
      { wallet: paypalId, cat: getCatId('Freelance'), type: 'income', amount: 390, desc: 'Freelance project payment', pname: 'Client ABC', date: '2024-06-12 10:00' },
      { wallet: visaId, cat: getCatId('Investment'), type: 'income', amount: 410, desc: 'Investment dividends', pname: 'Vanguard', date: '2024-06-13 12:30' },
      { wallet: masterId, cat: getCatId('Money Transfer In'), type: 'income', amount: 420, desc: 'Transfer from Mira May', pname: 'Mira May', date: '2024-06-15 18:00' },
      { wallet: visaId, cat: getCatId('Rent'), type: 'income', amount: 450, desc: 'Rental income from Booking', pname: 'Booking.com', date: '2024-06-16 18:55' },
      { wallet: paypalId, cat: getCatId('Freelance'), type: 'income', amount: 550, desc: 'Freelance project payment', pname: 'Client XYZ', date: '2024-06-17 11:05' },
      { wallet: paypalId, cat: getCatId('Freelance'), type: 'income', amount: 600, desc: 'Freelance project payment', pname: 'Client DEF', date: '2024-06-19 10:00' },
      { wallet: masterId, cat: getCatId('Money Transfer In'), type: 'income', amount: 850, desc: 'Transfer from Nellie Bayer', pname: 'Nellie Bayer', date: '2024-06-20 18:00' },
      { wallet: masterId, cat: getCatId('Money Transfer In'), type: 'income', amount: 1250, desc: 'Transfer from Chris Goodwin', pname: 'Chris Goodwin', date: '2024-06-20 18:45' },
      { wallet: visaId, cat: getCatId('Salary'), type: 'income', amount: 1500, desc: 'Paycheck from ABC Company', pname: 'ABC Company', date: '2024-06-25 10:00' },
      { wallet: visaId, cat: getCatId('Cashback'), type: 'income', amount: 25, desc: 'Cashback rewards', pname: 'VISA Rewards', date: '2024-06-02 11:30' },
      { wallet: visaId, cat: getCatId('Refund'), type: 'income', amount: 75, desc: 'Refund from XYZ Store', pname: 'XYZ Store', date: '2024-06-05 09:00' },
      { wallet: masterId, cat: getCatId('Investment'), type: 'income', amount: 100, desc: 'Investment dividends', pname: 'Fidelity', date: '2024-06-10 10:15' },
      // EXPENSES
      { wallet: visaId, cat: getCatId('Subscription'), type: 'expense', amount: 10, desc: 'YouTube Premium', pname: 'YouTube', date: '2024-07-25 12:30' },
      { wallet: masterId, cat: getCatId('Shopping'), type: 'expense', amount: 150, desc: 'Reserved purchase', pname: 'Reserved', date: '2024-07-26 15:00' },
      { wallet: masterId, cat: getCatId('Cafe & Restaurants'), type: 'expense', amount: 80, desc: 'Dinner at Yaposhka', pname: 'Yaposhka', date: '2024-07-27 09:00' },
      { wallet: visaId, cat: getCatId('Shopping'), type: 'expense', amount: 45, desc: 'Amazon order', pname: 'Amazon', date: '2024-07-29 14:20' },
      { wallet: masterId, cat: getCatId('Cafe & Restaurants'), type: 'expense', amount: 35, desc: 'Lunch', pname: 'Starbucks', date: '2024-07-10 09:15' },
      { wallet: visaId, cat: getCatId('Subscription'), type: 'expense', amount: 34, desc: 'Spotify Premium', pname: 'Spotify', date: '2024-07-28 10:30' },
      { wallet: visaId, cat: getCatId('Food & Groceries'), type: 'expense', amount: 120, desc: 'Weekly groceries', pname: 'Whole Foods', date: '2024-07-05 11:00' },
      { wallet: masterId, cat: getCatId('Transport'), type: 'expense', amount: 25, desc: 'Uber ride', pname: 'Uber', date: '2024-07-08 08:00' },
      { wallet: visaId, cat: getCatId('Entertainment'), type: 'expense', amount: 60, desc: 'Netflix + Disney+', pname: 'Netflix', date: '2024-07-01 00:00' },
      { wallet: masterId, cat: getCatId('Health & Beauty'), type: 'expense', amount: 90, desc: 'Skincare products', pname: 'Sephora', date: '2024-07-15 14:00' },
    ];

    for (const t of transactions) {
      await client.query(`
        INSERT INTO transactions (user_id, wallet_id, category_id, type, amount, description, payment_name, status, transaction_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8)
      `, [userId, t.wallet, t.cat, t.type, t.amount, t.desc, t.pname, t.date]);
    }

    // Budgets
    await client.query(`
      INSERT INTO budgets (user_id, category_id, name, amount, period, start_date, emoji, color) VALUES
        ($1, $2, 'Food & Groceries', 650.00, 'monthly', '2024-07-01', '🛒', '#00b894'),
        ($1, $3, 'Cafe & Restaurants', 2100.00, 'monthly', '2024-07-01', '☕', '#e17055'),
        ($1, $4, 'Health & Beauty', 500.00, 'monthly', '2024-07-01', '💄', '#fd79a8'),
        ($1, $5, 'Traveling', 400.00, 'monthly', '2024-07-01', '✈️', '#fdcb6e'),
        ($1, $6, 'Investments', 800.00, 'monthly', '2024-07-01', '📈', '#74b9ff'),
        ($1, $7, 'Entertainment', 1500.00, 'monthly', '2024-07-01', '🎬', '#a29bfe')
    `, [userId,
      getCatId('Food & Groceries'), getCatId('Cafe & Restaurants'),
      getCatId('Health & Beauty'), getCatId('Traveling'),
      getCatId('Investment'), getCatId('Entertainment')
    ]);

    // Saving goals
    await client.query(`
      INSERT INTO saving_goals (user_id, name, target_amount, current_amount, emoji, color, target_date, monthly_contribution) VALUES
        ($1, 'MacBook Pro', 1650.00, 412.50, '💻', '#6c5ce7', '2024-12-01', 100.00),
        ($1, 'New car', 60000.00, 25200.00, '🚗', '#a29bfe', '2026-06-01', 800.00),
        ($1, 'New house', 150000.00, 4500.00, '🏠', '#fd79a8', '2030-01-01', 500.00),
        ($1, 'Travel fund', 5000.00, 3400.00, '✈️', '#00b894', '2024-11-01', 200.00)
    `, [userId]);

    await client.query('COMMIT');
    console.log('✅ Seed completed! Demo user: adaline@tracksy.com / password123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

seed().catch(() => process.exit(1));
