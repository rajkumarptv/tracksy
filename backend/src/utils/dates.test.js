const test = require('node:test');
const assert = require('node:assert/strict');
const { addPeriod, addDays, diffDays, dayInMonth, toYMD } = require('./dates');

test('monthly addition clamps to month end and does not drift', () => {
  assert.equal(addPeriod('2026-01-31', 'monthly', 31), '2026-02-28');
  assert.equal(addPeriod('2026-02-28', 'monthly', 31), '2026-03-31');
  assert.equal(addPeriod('2028-01-31', 'monthly', 31), '2028-02-29'); // leap year
  assert.equal(addPeriod('2026-12-15', 'monthly'), '2027-01-15');
});

test('weekly, daily and yearly', () => {
  assert.equal(addPeriod('2026-12-28', 'weekly'), '2027-01-04');
  assert.equal(addPeriod('2026-02-28', 'daily'), '2026-03-01');
  assert.equal(addPeriod('2028-02-29', 'yearly'), '2029-02-28');
});

test('Date inputs use local parts, not UTC', () => {
  assert.equal(toYMD(new Date(2026, 10, 5)), '2026-11-05'); // local midnight, as pg returns DATE
});

test('dayInMonth, addDays, diffDays', () => {
  assert.equal(dayInMonth(2026, 6, 31), '2026-06-30');
  assert.equal(addDays('2026-11-30', 2), '2026-12-02');
  assert.equal(diffDays('2026-11-06', '2026-12-01'), 25);
});
