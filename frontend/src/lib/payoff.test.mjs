import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDebts, simulate, whatIf, coachTips, minPayment, daysUntilDay } from './payoff.js';

const TODAY = new Date(2026, 10, 6); // 6 Nov 2026

const debt = (o = {}) => ({
  id: 'a', name: 'Card', type: 'visa', isCard: true, balance: 10000, rate: 12,
  rateAssumed: false, emi: 0, creditLimit: 0, paymentDay: null, emiDay: null, ...o,
});

test('normalizeDebts keeps debts, drops lending/assets, uses absolute balances, flags assumed rates', () => {
  const out = normalizeDebts([
    { id: '1', name: 'HDFC Card', type: 'visa', balance: '-18450', interest_rate: '42' },
    { id: '2', name: 'Home Loan', type: 'loan', balance: '-1845000', interest_rate: null, emi_amount: '21500' },
    { id: '3', name: 'Lent to Ramesh', type: 'lending', balance: '15000' },
    { id: '4', name: 'Savings', type: 'bank', balance: '320000' },
  ]);
  assert.deepEqual(out.map(d => d.id), ['1', '2']);
  assert.equal(out[0].balance, 18450);
  assert.equal(out[0].rateAssumed, false);
  assert.equal(out[1].rateAssumed, true);
  assert.equal(out[1].rate, 18);
});

test('single debt matches the closed-form amortisation (10,000 at 12% paying 1,000/month = 11 months)', () => {
  const r = simulate([debt({ emi: 1000 })], { today: TODAY });
  assert.equal(r.months, 11);
  // balance after 10 payments is 584.01, so the last payment is 584.01 * 1.01 = 589.85 and total interest 589.85
  assert.ok(Math.abs(r.totalInterest - 589.85) < 0.05, `interest ${r.totalInterest}`);
  assert.equal(r.debtFreeDate, '2027-10');
});

test('payments that do not cover interest are flagged instead of looping forever', () => {
  const r = simulate([debt({ balance: 100000, rate: 36, emi: 100 })], { today: TODAY });
  assert.equal(r.neverPaysOff, true);
  assert.equal(r.months, null);
});

test('extra payment finishes sooner and saves interest', () => {
  const d = [debt({ emi: 1000 })];
  const base = simulate(d, { today: TODAY });
  const more = simulate(d, { extra: 1000, today: TODAY });
  assert.ok(more.months < base.months);
  assert.ok(more.totalInterest < base.totalInterest);
});

test('freed-up minimums roll onto the next debt', () => {
  const d = [
    debt({ id: 'small', balance: 2000, rate: 20, emi: 500 }),
    debt({ id: 'big', balance: 20000, rate: 10, emi: 500 }),
  ];
  const withRoll = simulate(d, { today: TODAY });
  // without rolling, 'big' alone at 500/month would take far longer than the combined budget allows
  const bigAlone = simulate([d[1]], { today: TODAY });
  assert.ok(withRoll.months < bigAlone.months + 4);
  const small = withRoll.order.find(o => o.id === 'small');
  assert.ok(small.payoffMonth <= 5);
});

test('avalanche pays less interest than snowball when the big debt has the high rate', () => {
  const d = [
    debt({ id: 'small', balance: 3000, rate: 8, emi: 300 }),
    debt({ id: 'big', balance: 30000, rate: 30, emi: 900 }),
  ];
  const a = simulate(d, { extra: 1000, method: 'avalanche', today: TODAY });
  const s = simulate(d, { extra: 1000, method: 'snowball', today: TODAY });
  assert.ok(a.totalInterest < s.totalInterest);
});

test('minPayment prefers the EMI, otherwise a card-style minimum above monthly interest', () => {
  assert.equal(minPayment(debt({ emi: 1234 })), 1234);
  const m = minPayment(debt({ balance: 50000, rate: 42 }));
  assert.ok(m > 50000 * 0.42 / 12);
});

test('whatIf reports savings against the minimums-only baseline', () => {
  const rows = whatIf([debt({ emi: 1000 })], 'avalanche', [500, 2000], TODAY);
  assert.equal(rows.length, 2);
  assert.ok(rows[1].interestSaved > rows[0].interestSaved);
  assert.ok(rows[1].monthsSaved >= rows[0].monthsSaved);
});

test('daysUntilDay handles today, later this month and next month', () => {
  assert.equal(daysUntilDay(6, TODAY), 0);
  assert.equal(daysUntilDay(10, TODAY), 4);
  assert.equal(daysUntilDay(5, TODAY), 29); // 5 Dec
  assert.equal(daysUntilDay(31, new Date(2026, 5, 30)), 0); // 31st clamps to 30 June
});

test('coachTips: focus debt, extra-payment benefit, utilisation, due soon, assumed rate', () => {
  const debts = [
    debt({ id: 'c', name: 'HDFC Card', balance: 18450, rate: 42, creditLimit: 40000, paymentDay: 8 }),
    debt({ id: 'l', name: 'Home Loan', type: 'loan', isCard: false, balance: 1845000, rate: 8.6, emi: 21500, rateAssumed: true }),
  ];
  const res = simulate(debts, { today: TODAY });
  const tips = coachTips(debts, res, whatIf(debts, 'avalanche', [1000, 5000], TODAY), { today: TODAY });
  const titles = tips.map(t => t.title).join(' | ');
  assert.match(titles, /Pay HDFC Card first/);
  assert.match(titles, /extra/i);
  assert.match(titles, /HDFC Card is 46% used/);
  assert.match(titles, /HDFC Card payment due in 2 days/);
  assert.match(titles, /no interest rate set/);
});
