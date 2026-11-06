const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { toYMD, addDays } = require('../utils/dates');

// Stand in for the database so the controller's own logic can be tested without Postgres.
const today = toYMD(new Date());
const rows = {
  wallets: [
    { id: 'w1', name: 'Savings', type: 'bank', balance: '100000', emi_amount: null, emi_day: null, payment_day: null },
    { id: 'w2', name: 'Cash', type: 'cash', balance: '5000', emi_amount: null, emi_day: null, payment_day: null },
    { id: 'w3', name: 'HDFC Card', type: 'visa', balance: '-12000', emi_amount: null, emi_day: null, payment_day: String(parseInt(today.slice(8), 10)) },
    { id: 'w4', name: 'Home Loan', type: 'loan', balance: '-900000', emi_amount: '21500', emi_day: '5', payment_day: null },
  ],
  recurring: [],
  tx: [],
  first: addDays(today, -90),
};
const fakeQuery = async sql => {
  if (sql.includes('FROM wallets WHERE user_id')) return { rows: rows.wallets };
  if (sql.includes('FROM recurring_transactions')) return { rows: rows.recurring };
  if (sql.includes('MIN(transaction_date)')) return { rows: [{ first: rows.first }] };
  if (sql.includes('JOIN wallets w ON w.id = t.wallet_id')) return { rows: rows.tx };
  throw new Error('unexpected query: ' + sql.slice(0, 60));
};
require.cache[require.resolve('../db')] = { id: 'db', filename: 'db', loaded: true, exports: { query: fakeQuery } };
const { getCashflow } = require('./forecastController');

const call = async (q = {}) => {
  let body, status = 200;
  const res = { json: b => { body = b; return res; }, status: s => { status = s; return res; } };
  await getCashflow({ user: { userId: 'u1' }, query: q }, res);
  return { body, status };
};

test('starts from bank + cash only, and models the card bill and loan EMI', async () => {
  rows.recurring = []; rows.tx = [];
  const { body } = await call({ days: '60' });
  assert.equal(body.success, true);
  assert.equal(body.data.startBalance, 105000);          // card and loan are not spendable
  const kinds = body.data.events.map(e => e.kind);
  assert.ok(kinds.includes('card'));
  assert.ok(kinds.includes('emi'));
  assert.equal(body.data.events.find(e => e.kind === 'card').amount, -12000);
});

test('a recurring rule equal to the EMI replaces the modelled EMI (no double count)', async () => {
  rows.recurring = [{ id: 'r1', type: 'expense', amount: '21500', payment_name: 'Home loan EMI', frequency: 'monthly',
    start_date: addDays(today, -20), next_run: addDays(today, 10), end_date: null, wallet_type: 'bank' }];
  rows.tx = [];
  const { body } = await call({ days: '60' });
  assert.equal(body.data.events.filter(e => e.kind === 'emi').length, 0);
  assert.ok(body.data.events.filter(e => e.kind === 'recurring').length >= 1);
});

test('everyday spend ignores commitment categories and loan repayments', async () => {
  rows.recurring = [];
  const d = addDays(today, -3);
  rows.tx = [
    { transaction_date: d, amount: '600', payment_name: 'Swiggy', category_name: 'Food & Dining' },
    { transaction_date: d, amount: '18000', payment_name: 'Landlord', category_name: 'Rent' },
    { transaction_date: d, amount: '5000', payment_name: 'Interest Payment', category_name: 'Finance Charges' },
    { transaction_date: d, amount: '2000', payment_name: 'HDFC bill', category_name: 'Bills & Utilities' },
  ];
  rows.first = addDays(today, -30);                  // short history -> flat daily average over 30 days
  const { body } = await call({ days: '30' });
  rows.first = addDays(today, -90);
  // only the 600 food spend counts: 600 / 30 days = 20 a day, over a 30-day horizon = 600
  assert.equal(Math.round(body.data.summary.variableSpend), 600);
});

test('days is clamped to 7..120', async () => {
  rows.tx = [];
  assert.equal((await call({ days: '3' })).body.data.days, 7);
  assert.equal((await call({ days: '999' })).body.data.days, 120);
  assert.equal((await call({})).body.data.days, 60);
});
