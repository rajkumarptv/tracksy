const test = require('node:test');
const assert = require('node:assert/strict');
const { buildForecast, variableSpend, ruleOccurrences, nextOnOrAfter } = require('./forecastEngine');

const TODAY = '2026-11-06';

const scenario = () => buildForecast({
  today: TODAY, days: 30, startBalance: 40000,
  recurring: [
    { name: 'Rent', type: 'expense', amount: 18000, frequency: 'monthly', start_date: '2026-10-20', next_run: '2026-11-20' },
    { name: 'Salary', type: 'income', amount: 65000, frequency: 'monthly', start_date: '2026-09-01', next_run: '2026-12-01' },
  ],
  cards: [{ name: 'HDFC Card', balance: -18450, payment_day: 8 }],
  loans: [{ name: 'Home Loan', balance: -1845000, emi_amount: 21500, emi_day: 5 }],
  variable: { dailyAvg: 1000, byWeekday: null, sampleDays: 30 },
});

test('hand-computed scenario: shortfall on 20 Nov, lowest on 30 Nov, recovery after salary', () => {
  const f = scenario();
  const at = d => f.series.find(p => p.date === d).balance;
  assert.equal(at('2026-11-06'), 40000);
  assert.equal(at('2026-11-07'), 39000);
  assert.equal(at('2026-11-08'), 19550);   // 38,000 less the 18,450 card bill
  assert.equal(at('2026-11-19'), 8550);
  assert.equal(at('2026-11-20'), -10450);  // rent lands
  assert.equal(at('2026-11-30'), -20450);
  assert.equal(at('2026-12-01'), 43550);   // salary
  assert.equal(at('2026-12-05'), 18050);   // EMI
  assert.equal(f.summary.endBalance, 17050);
  assert.equal(f.summary.shortfallDate, '2026-11-20');
  assert.equal(f.summary.daysUntilShortfall, 14);
  assert.equal(f.summary.lowestDate, '2026-11-30');
  assert.equal(f.summary.shortfallAmount, 20450);
});

test('events are sorted and labelled by kind', () => {
  const f = scenario();
  assert.deepEqual(f.events.map(e => `${e.date} ${e.kind}`), [
    '2026-11-08 card', '2026-11-20 recurring', '2026-12-01 recurring', '2026-12-05 emi',
  ]);
});

test('no shortfall when income covers everything', () => {
  const f = buildForecast({ today: TODAY, days: 30, startBalance: 100000, variable: { dailyAvg: 500 } });
  assert.equal(f.summary.shortfallDate, null);
  assert.equal(f.summary.shortfallAmount, 0);
  assert.equal(f.summary.endBalance, 100000 - 30 * 500);
});

test('an overdue rule counts once today and then follows its schedule', () => {
  const dates = ruleOccurrences(
    { frequency: 'weekly', start_date: '2026-11-01', next_run: '2026-11-01' }, TODAY, '2026-12-06');
  assert.deepEqual(dates, ['2026-11-06', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29', '2026-12-06']);
});

test('monthly rules anchored on the 31st stay on month end', () => {
  const dates = ruleOccurrences(
    { frequency: 'monthly', start_date: '2026-01-31', next_run: '2026-11-30' }, TODAY, '2027-01-05');
  assert.deepEqual(dates, ['2026-11-30', '2026-12-31']);
});

test('end date stops a rule', () => {
  const dates = ruleOccurrences(
    { frequency: 'weekly', start_date: '2026-11-06', next_run: '2026-11-06', end_date: '2026-11-20' }, TODAY, '2026-12-31');
  assert.deepEqual(dates, ['2026-11-06', '2026-11-13', '2026-11-20']);
});

test('rules charged to a card are left out, and cards without a payment day are noted', () => {
  const f = buildForecast({
    today: TODAY, days: 30, startBalance: 1000,
    recurring: [{ name: 'Netflix', type: 'expense', amount: 649, frequency: 'monthly', start_date: '2026-11-10', next_run: '2026-11-10', spendable: false }],
    cards: [{ name: 'Axis Card', balance: -5000, payment_day: null }],
    variable: { dailyAvg: 0 },
  });
  assert.equal(f.events.length, 0);
  assert.ok(f.assumptions.some(a => a.includes('Axis Card')));
});

test('nextOnOrAfter rolls into next month and clamps short months', () => {
  assert.equal(nextOnOrAfter('2026-11-06', 8), '2026-11-08');
  assert.equal(nextOnOrAfter('2026-11-06', 5), '2026-12-05');
  assert.equal(nextOnOrAfter('2026-12-20', 5), '2027-01-05');
  assert.equal(nextOnOrAfter('2026-06-10', 31), '2026-06-30');
});

test('variableSpend: flat average with short history, weekday profile once there are 8 weeks', () => {
  const rows = [{ date: '2026-11-05', amount: 300 }, { date: '2026-11-01', amount: 700 }, { date: '2026-11-06', amount: 9999 }];
  const short = variableSpend(rows, TODAY, 10);
  assert.equal(short.sampleDays, 10);
  assert.equal(short.dailyAvg, 100);      // (300 + 700) / 10, today is excluded
  assert.equal(short.byWeekday, null);

  const long = variableSpend(rows, TODAY, 90);
  assert.equal(long.sampleDays, 60);
  assert.ok(Array.isArray(long.byWeekday) && long.byWeekday.length === 7);
  const f = buildForecast({ today: TODAY, days: 7, startBalance: 0, variable: long });
  assert.equal(f.confidence, 'high');
});

test('confidence reflects how much history there is', () => {
  const c = n => buildForecast({ today: TODAY, days: 7, startBalance: 0, variable: { dailyAvg: 0, sampleDays: n } }).confidence;
  assert.equal(c(3), 'low');
  assert.equal(c(20), 'medium');
  assert.equal(c(60), 'high');
});
