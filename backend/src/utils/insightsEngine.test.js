const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze, normalizeMerchant, subscriptions } = require('./insightsEngine');

const TODAY = '2026-11-06';
const MONTH = '2026-11';
const tx = (date, amount, merchant, category, type = 'expense') => ({ date, amount, merchant, category, type });

const data = () => [
  tx('2026-11-01', 65000, 'Employer', 'Salary', 'income'),
  // steady monthly subscription
  ...['2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10', '2026-10-10'].map(d => tx(d, 649, 'NETFLIX 1234', 'Entertainment')),
  // monthly subscription with a price rise
  ...['2026-06-15', '2026-07-15', '2026-08-15', '2026-09-15'].map(d => tx(d, 119, 'Spotify', 'Entertainment')),
  tx('2026-10-15', 149, 'Spotify', 'Entertainment'),
  // used to charge monthly, then stopped
  ...['2026-05-02', '2026-06-02', '2026-07-02', '2026-08-02'].map(d => tx(d, 1200, 'Gym Membership', 'Health')),
  // shopping spike this month
  tx('2026-08-12', 2000, 'Amazon', 'Shopping'), tx('2026-09-14', 2500, 'Myntra', 'Shopping'), tx('2026-10-09', 2000, 'Ajio', 'Shopping'),
  tx('2026-11-03', 6000, 'Croma', 'Shopping'),
  // tiny rise that must not be flagged (below the ₹500 floor)
  tx('2026-08-20', 100, 'Metro', 'Transport'), tx('2026-09-20', 100, 'Metro card', 'Transport'), tx('2026-10-20', 100, 'Uber', 'Transport'),
  tx('2026-11-04', 300, 'Ola', 'Transport'),
  // duplicate charge
  tx('2026-11-03', 481, 'Dominos', 'Food & Dining'), tx('2026-11-04', 481, 'Dominos', 'Food & Dining'),
  // single large purchase for a category that is normally small
  tx('2026-08-05', 1000, 'Shop A', 'Gadgets'), tx('2026-09-05', 1200, 'Shop B', 'Gadgets'),
  tx('2026-10-05', 1100, 'Shop C', 'Gadgets'), tx('2026-10-25', 900, 'Shop D', 'Gadgets'),
  tx('2026-11-05', 5000, 'Reliance Digital', 'Gadgets'),
  // last month, same point (for the comparison headline)
  tx('2026-10-02', 3000, 'Misc', 'Other'),
];

const run = (rules = []) => analyze({ today: TODAY, month: MONTH, transactions: data(), rules });

test('normalizeMerchant groups reference numbers and punctuation together', () => {
  assert.equal(normalizeMerchant('NETFLIX 1234'), 'netflix');
  assert.equal(normalizeMerchant('Swiggy*Order #55'), 'swiggy order');
  assert.equal(normalizeMerchant(null), '');
});

test('detects monthly subscriptions and totals the active ones', () => {
  const r = run();
  const names = r.subscriptions.items.map(i => i.merchant);
  assert.ok(names.includes('NETFLIX 1234'));
  assert.ok(names.includes('Spotify'));
  assert.ok(!names.includes('Croma'));
  const netflix = r.subscriptions.items.find(i => i.merchant === 'NETFLIX 1234');
  assert.equal(netflix.cadence, 'monthly');
  assert.equal(netflix.status, 'active');
  // Netflix 649 + Spotify 149 are active; the lapsed gym is excluded from the total
  assert.equal(Math.round(r.subscriptions.monthlyTotal), 649 + 149);
  assert.equal(Math.round(r.subscriptions.annualTotal), (649 + 149) * 12);
});

test('flags a price increase and a subscription that stopped charging', () => {
  const items = run().subscriptions.items;
  const spotify = items.find(i => i.merchant === 'Spotify');
  assert.deepEqual(spotify.priceChange, { from: 119, to: 149, pct: 25 });
  assert.equal(items.find(i => i.merchant === 'Gym Membership').status, 'missing');
});

test('marks subscriptions that are not tracked as recurring rules', () => {
  const items = run([{ name: 'Spotify', amount: 149 }]).subscriptions.items;
  assert.equal(items.find(i => i.merchant === 'Spotify').tracked, true);
  assert.equal(items.find(i => i.merchant === 'NETFLIX 1234').tracked, false);
});

test('category spike is reported with its usual level, and small rises are ignored', () => {
  const spikes = run().anomalies.categorySpikes;
  const shopping = spikes.find(s => s.category === 'Shopping');
  assert.ok(shopping);
  assert.equal(Math.round(shopping.average), 2167);
  assert.equal(shopping.pct, 177);
  assert.ok(!spikes.some(s => s.category === 'Transport'), 'a ₹200 rise is under the floor');
});

test('flags a duplicate charge and an unusually large single purchase', () => {
  const a = run().anomalies;
  assert.equal(a.duplicates.length, 1);
  assert.equal(a.duplicates[0].merchant, 'Dominos');
  assert.deepEqual(a.duplicates[0].dates, ['2026-11-03', '2026-11-04']);
  assert.equal(a.outliers[0].merchant, 'Reliance Digital');
  assert.equal(a.outliers[0].amount, 5000);
});

test('subscriptions are not reported as duplicates or outliers', () => {
  const a = run().anomalies;
  assert.ok(!a.duplicates.some(d => /netflix|spotify/i.test(d.merchant)));
});

test('narrative: headline compares with the same point last month; bullets cover savings, movers and subscriptions', () => {
  const r = run();
  assert.match(r.headline, /so far this month/);
  assert.ok(r.bullets.some(b => /Income ₹65,000/.test(b)));
  assert.ok(r.bullets.some(b => /Shopping is 177% above its usual ₹2,167/.test(b)));
  assert.ok(!r.bullets.some(b => /Shopping is up/.test(b)), 'same category is not repeated');
  assert.ok(r.bullets.some(b => /Recurring charges cost about ₹798 a month/.test(b)));
  assert.ok(r.bullets.some(b => /Spotify went up from ₹119 to ₹149/.test(b)));
  assert.ok(r.bullets.some(b => /Gym Membership hasn't charged since 2026-08-02/.test(b)));
  assert.ok(r.bullets.length <= 7);
});

test('empty month produces a plain headline and no bullets', () => {
  const r = analyze({ today: TODAY, month: MONTH, transactions: [], rules: [] });
  assert.equal(r.headline, 'No transactions recorded for November 2026 yet.');
  assert.deepEqual(r.bullets, []);
  assert.equal(r.subscriptions.items.length, 0);
});

test('two or fewer charges, or irregular gaps, are not subscriptions', () => {
  const rows = [
    tx('2026-08-01', 500, 'Cafe Z', 'Food'), tx('2026-09-01', 500, 'Cafe Z', 'Food'),
    tx('2026-07-01', 300, 'Irregular', 'Food'), tx('2026-07-09', 300, 'Irregular', 'Food'), tx('2026-09-20', 300, 'Irregular', 'Food'),
  ];
  assert.equal(subscriptions(rows, TODAY, []).items.length, 0);
});
