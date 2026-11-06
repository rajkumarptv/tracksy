// Cash-flow forecast: projects the spendable balance (bank + cash) day by day.
// Pure functions only (no DB), so the maths can be tested on its own.
const { addPeriod, addDays, diffDays, dayInMonth, parseYMD, toYMD, weekday } = require('./dates');

const MAX_EVENTS_PER_RULE = 400;

// First date on or after `today` that falls on day-of-month `day` (clamped to short months).
function nextOnOrAfter(today, day) {
  const { y, m } = parseYMD(today);
  const thisMonth = dayInMonth(y, m, day);
  if (thisMonth >= today) return thisMonth;
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  return dayInMonth(ny, nm, day);
}

// Every occurrence of a recurring rule inside [today, last]. A rule whose next_run is already
// in the past still has an unposted payment, so one occurrence is counted today.
function ruleOccurrences(rule, today, last) {
  const out = [];
  const start = toYMD(rule.next_run || rule.start_date);
  const anchor = rule.start_date ? parseYMD(rule.start_date).d : undefined;
  const end = rule.end_date ? toYMD(rule.end_date) : null;
  let cursor = start;
  if (cursor < today) {
    if (!end || start <= end) out.push(today);
    let guard = 0;
    while (cursor < today && guard++ < MAX_EVENTS_PER_RULE) cursor = addPeriod(cursor, rule.frequency, anchor);
  }
  let guard = 0;
  while (cursor <= last && guard++ < MAX_EVENTS_PER_RULE) {
    if (end && cursor > end) break;
    out.push(cursor);
    cursor = addPeriod(cursor, rule.frequency, anchor);
  }
  return out;
}

/**
 * @param {object} o
 * @param {string} o.today        'YYYY-MM-DD'
 * @param {number} o.days         horizon (days after today)
 * @param {number} o.startBalance current spendable balance
 * @param {Array}  o.recurring    active rules: {name,type,amount,frequency,start_date,next_run,end_date,spendable}
 * @param {Array}  o.cards        credit cards: {name,balance(negative = owed),payment_day}
 * @param {Array}  o.loans        loans: {name,emi_amount,emi_day,balance}
 * @param {object} o.variable     {dailyAvg, byWeekday:[7]|null, sampleDays}
 */
function buildForecast({ today, days, startBalance, recurring = [], cards = [], loans = [], variable = {} }) {
  const last = addDays(today, days);
  const events = [];
  const assumptions = [];

  for (const r of recurring) {
    if (r.spendable === false) continue; // charged to a card/loan, so it shows up through the card bill instead
    const amount = parseFloat(r.amount) || 0;
    if (!amount) continue;
    const signed = r.type === 'income' ? amount : -amount;
    for (const date of ruleOccurrences(r, today, last)) {
      events.push({ date, label: r.name || (r.type === 'income' ? 'Income' : 'Payment'), amount: signed, kind: 'recurring' });
    }
  }

  for (const c of cards) {
    const owed = Math.abs(parseFloat(c.balance) || 0);
    if (!(parseFloat(c.balance) < 0) || owed < 1) continue;
    if (!c.payment_day) { assumptions.push(`${c.name} has no payment day set, so its bill is not in the forecast.`); continue; }
    const date = nextOnOrAfter(today, parseInt(c.payment_day, 10));
    if (date <= last) events.push({ date, label: `${c.name} bill`, amount: -owed, kind: 'card' });
  }

  for (const l of loans) {
    const emi = parseFloat(l.emi_amount) || 0;
    if (!emi || !l.emi_day || !(Math.abs(parseFloat(l.balance) || 0) > 0)) continue;
    let { y, m } = parseYMD(today);
    for (let i = 0; i < 6; i++) {
      const date = dayInMonth(y, m, parseInt(l.emi_day, 10));
      if (date >= today && date <= last) events.push({ date, label: `${l.name} EMI`, amount: -emi, kind: 'emi' });
      if (m === 12) { y++; m = 1; } else m++;
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount);

  const byDate = {};
  for (const e of events) (byDate[e.date] = byDate[e.date] || []).push(e);

  const flat = parseFloat(variable.dailyAvg) || 0;
  const perDay = d => (variable.byWeekday ? (variable.byWeekday[weekday(d)] || 0) : flat);

  const series = [];
  let balance = startBalance;
  let variableTotal = 0, totalIn = 0, totalOut = 0;
  let lowest = { balance: startBalance, date: today };
  let shortfallDate = null;

  for (let i = 0; i <= days; i++) {
    const date = addDays(today, i);
    if (i > 0) { // today's spending so far is already in the starting balance
      const v = perDay(date);
      balance -= v; variableTotal += v;
    }
    for (const e of byDate[date] || []) {
      balance += e.amount;
      if (e.amount > 0) totalIn += e.amount; else totalOut -= e.amount;
    }
    const rounded = Math.round(balance * 100) / 100;
    series.push({ date, balance: rounded });
    if (rounded < lowest.balance) lowest = { balance: rounded, date };
    if (shortfallDate === null && rounded < 0) shortfallDate = date;
  }

  const sample = variable.sampleDays || 0;
  const confidence = sample >= 56 ? 'high' : sample >= 14 ? 'medium' : 'low';
  assumptions.push(
    variable.byWeekday
      ? 'Everyday spending uses your average for each weekday over the last 8+ weeks.'
      : `Everyday spending uses your average of about ${Math.round(flat).toLocaleString('en-IN')} a day${sample ? ` over the last ${sample} days` : ''}.`,
    'Recurring rules, card bills (the current outstanding on the payment day) and loan EMIs are included.',
    'Future card spending is not predicted. It will show up in later card bills.',
  );
  if (confidence === 'low') assumptions.push('Little transaction history so far, so treat this as a rough estimate.');

  return {
    startBalance, days, today, last,
    series, events,
    summary: {
      endBalance: series[series.length - 1].balance,
      lowestBalance: lowest.balance,
      lowestDate: lowest.date,
      shortfallDate,
      shortfallAmount: lowest.balance < 0 ? Math.round(-lowest.balance * 100) / 100 : 0,
      totalIn: Math.round(totalIn * 100) / 100,
      totalOut: Math.round(totalOut * 100) / 100,
      variableSpend: Math.round(variableTotal * 100) / 100,
      daysUntilShortfall: shortfallDate ? diffDays(today, shortfallDate) : null,
    },
    confidence,
    assumptions,
  };
}

/**
 * Everyday (variable) spend from completed expenses: caller passes rows already filtered to
 * bank/cash wallets and stripped of recurring, commitment and loan-payment rows.
 * rows: [{date:'YYYY-MM-DD', amount}], historyDays: days since the user's first transaction.
 */
function variableSpend(rows, today, historyDays, windowMax = 60) {
  const sampleDays = Math.max(1, Math.min(windowMax, historyDays));
  const from = addDays(today, -sampleDays);
  const inWindow = rows.filter(r => r.date >= from && r.date < today);
  const total = inWindow.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const dailyAvg = total / sampleDays;

  let byWeekday = null;
  if (sampleDays >= 56) {
    const sums = [0, 0, 0, 0, 0, 0, 0], counts = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < sampleDays; i++) counts[weekday(addDays(from, i))]++;
    for (const r of inWindow) sums[weekday(r.date)] += parseFloat(r.amount) || 0;
    byWeekday = sums.map((s, i) => (counts[i] ? s / counts[i] : 0));
  }
  return { dailyAvg, byWeekday, sampleDays };
}

module.exports = { buildForecast, variableSpend, ruleOccurrences, nextOnOrAfter };
