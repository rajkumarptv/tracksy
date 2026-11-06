const test = require('node:test');
const assert = require('node:assert/strict');

const seen = [];
const fakeQuery = async (sql, params) => {
  seen.push({ sql, params });
  if (sql.includes('FROM transactions')) {
    return { rows: [
      { transaction_date: new Date(2026, 10, 1), type: 'income', amount: '65000', payment_name: 'Employer', category_name: 'Salary' },
      { transaction_date: new Date(2026, 10, 3), type: 'expense', amount: '450', payment_name: 'Swiggy', category_name: 'Food & Dining' },
    ] };
  }
  if (sql.includes('FROM recurring_transactions')) return { rows: [] };
  throw new Error('unexpected query');
};
require.cache[require.resolve('../db')] = { id: 'db', filename: 'db', loaded: true, exports: { query: fakeQuery } };
const { getSmart } = require('./insightsController');

const call = async (q) => {
  let body, status = 200;
  const res = { json: b => { body = b; return res; }, status: s => { status = s; return res; } };
  await getSmart({ user: { userId: 'u1' }, query: q }, res);
  return { body, status };
};

test('rejects a malformed month', async () => {
  const { body, status } = await call({ month: '2026-13' });
  assert.equal(status, 400);
  assert.equal(body.success, false);
});

test('reads six months ending at the requested month and returns the analysis', async () => {
  seen.length = 0;
  const { body } = await call({ month: '2026-11' });
  const params = seen.find(s => s.sql.includes('FROM transactions')).params;
  assert.deepEqual(params, ['u1', '2026-06-01', '2026-12-01']);
  assert.equal(body.success, true);
  assert.equal(body.data.month, '2026-11');
  assert.equal(body.data.monthLabel, 'November 2026');
  assert.ok(Array.isArray(body.data.bullets));
  assert.ok(body.data.anomalies && body.data.subscriptions);
});

test('year boundary: January reads back into the previous year', async () => {
  seen.length = 0;
  await call({ month: '2027-01' });
  const params = seen.find(s => s.sql.includes('FROM transactions')).params;
  assert.deepEqual(params, ['u1', '2026-08-01', '2027-02-01']);
});
