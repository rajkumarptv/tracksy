// Rule-based "smart insights": category spikes, outliers, duplicate charges, subscription audit
// and a templated monthly summary. Pure functions (no DB, no LLM), so every number is explainable.
const { addDays, diffDays, parseYMD, daysInMonth } = require('./dates');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MIN_SPIKE = 500;      // a category must exceed its usual by at least this much (₹) to count
const MIN_OUTLIER = 1000;   // single transaction floor for "unusually large"
const MIN_DUP = 200;        // ignore tiny repeat purchases (two chais are not a duplicate charge)

const inr = n => `₹${Math.round(n).toLocaleString('en-IN')}`;
const sum = a => a.reduce((s, x) => s + x, 0);
const mean = a => (a.length ? sum(a) / a.length : 0);
const median = a => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const sd = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };

const monthKey = date => date.slice(0, 7);
const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};
const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTH_NAMES[m - 1]} ${y}`; };

/** 'NETFLIX 1234' / 'Swiggy*Order #55' -> lowercase letters only, so repeat charges group together. */
function normalizeMerchant(name) {
  return String(name || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length > 1).join(' ');
}

/** Categories whose spend this month is well above their recent monthly norm. */
function categorySpikes(expenses, month) {
  const prior = [shiftMonth(month, -1), shiftMonth(month, -2), shiftMonth(month, -3)];
  const totals = {};
  for (const t of expenses) {
    const m = monthKey(t.date);
    if (m !== month && !prior.includes(m)) continue;
    const c = t.category || 'Uncategorised';
    totals[c] = totals[c] || {};
    totals[c][m] = (totals[c][m] || 0) + t.amount;
  }
  const out = [];
  for (const [category, byMonth] of Object.entries(totals)) {
    const amount = byMonth[month] || 0;
    const history = prior.map(m => byMonth[m]).filter(v => v > 0);
    if (history.length < 2 || !amount) continue;   // need a real baseline
    const avg = mean(history);
    if (amount >= avg * 1.5 && amount - avg >= MIN_SPIKE) {
      out.push({ category, amount, average: avg, pct: Math.round(((amount - avg) / avg) * 100) });
    }
  }
  return out.sort((a, b) => (b.amount - b.average) - (a.amount - a.average)).slice(0, 5);
}

/** Single purchases far above what that category normally sees. */
function outliers(expenses, month) {
  const prior = [shiftMonth(month, -1), shiftMonth(month, -2), shiftMonth(month, -3)];
  const history = {};
  for (const t of expenses) if (prior.includes(monthKey(t.date))) (history[t.category || 'Uncategorised'] = history[t.category || 'Uncategorised'] || []).push(t.amount);
  const out = [];
  for (const t of expenses) {
    if (monthKey(t.date) !== month || t.amount < MIN_OUTLIER) continue;
    const h = history[t.category || 'Uncategorised'];
    if (!h || h.length < 4) continue;
    const typical = median(h);
    if (t.amount >= Math.max(3 * typical, typical + 2 * sd(h))) {
      out.push({ merchant: t.merchant || t.category || 'Purchase', category: t.category || 'Uncategorised', amount: t.amount, date: t.date, typical });
    }
  }
  return out.sort((a, b) => b.amount - a.amount).slice(0, 3);
}

/** Same merchant, same amount, within two days. */
function duplicates(expenses, today, lookbackDays = 35) {
  const from = addDays(today, -lookbackDays);
  const byKey = {};
  for (const t of expenses) {
    if (t.date < from || t.amount < MIN_DUP) continue;
    const m = normalizeMerchant(t.merchant);
    if (!m) continue;
    (byKey[`${m}|${t.amount}`] = byKey[`${m}|${t.amount}`] || []).push(t);
  }
  const out = [];
  for (const group of Object.values(byKey)) {
    group.sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < group.length; i++) {
      if (diffDays(group[i - 1].date, group[i].date) <= 2) {
        out.push({ merchant: group[i].merchant, amount: group[i].amount, dates: [group[i - 1].date, group[i].date] });
        break;
      }
    }
  }
  return out.slice(0, 5);
}

/** Merchants charged on a steady cadence at a steady price. */
function subscriptions(expenses, today, rules = []) {
  const groups = {};
  for (const t of expenses) {
    const m = normalizeMerchant(t.merchant);
    if (!m) continue;
    (groups[m] = groups[m] || { key: m, name: t.merchant, charges: [] }).charges.push(t);
  }
  const ruleNames = rules.map(r => ({ n: normalizeMerchant(r.name), amount: parseFloat(r.amount) || 0 }));
  const items = [];

  for (const g of Object.values(groups)) {
    const ch = g.charges.sort((a, b) => a.date.localeCompare(b.date));
    if (ch.length < 3) continue;
    const gaps = ch.slice(1).map((c, i) => diffDays(ch[i].date, c.date)).filter(d => d > 0);
    if (gaps.length < 2) continue;
    const gap = median(gaps);
    const cadence = Math.abs(gap - 7) <= 1 ? 'weekly' : Math.abs(gap - 30) <= 4 ? 'monthly' : null;
    if (!cadence) continue;

    const amounts = ch.map(c => c.amount);
    const med = median(amounts);
    const stable = amounts.filter(a => Math.abs(a - med) <= med * 0.1).length;
    if (stable < amounts.length - 1) continue;      // allow one price change or one odd charge

    const last = ch[ch.length - 1];
    const prev = amounts.slice(0, -1);
    const prevMed = median(prev);
    const change = prevMed > 0 ? (last.amount - prevMed) / prevMed : 0;
    const priceChange = Math.abs(change) >= 0.05 && prev.length >= 2
      ? { from: prevMed, to: last.amount, pct: Math.round(change * 100) } : null;

    const nextExpected = addDays(last.date, Math.round(gap));
    const grace = Math.max(5, Math.round(gap * 0.2));
    const status = diffDays(nextExpected, today) > grace ? 'missing' : 'active';

    const tracked = ruleNames.some(r =>
      (r.n && r.n.length >= 4 && (g.key.includes(r.n) || r.n.includes(g.key))) || Math.abs(r.amount - last.amount) < 1);
    const monthlyCost = cadence === 'weekly' ? (last.amount * 52) / 12 : last.amount;

    items.push({
      merchant: g.name, cadence, amount: last.amount, monthlyCost, annualCost: monthlyCost * 12,
      charges: ch.length, lastDate: last.date, nextExpected, status, priceChange, tracked,
    });
  }
  items.sort((a, b) => b.monthlyCost - a.monthlyCost);
  const active = items.filter(i => i.status === 'active');
  return {
    items,
    monthlyTotal: sum(active.map(i => i.monthlyCost)),
    annualTotal: sum(active.map(i => i.annualCost)),
  };
}

/** Month-to-date vs the same point last month when `month` is still in progress. */
function monthSummary(transactions, month, today) {
  const prev = shiftMonth(month, -1);
  const inProgress = monthKey(today) === month;
  const cutDay = inProgress ? parseYMD(today).d : 31;
  const take = (m, limitDay) => transactions.filter(t => monthKey(t.date) === m && parseYMD(t.date).d <= limitDay);
  const cur = take(month, 31), before = take(prev, Math.min(cutDay, daysInMonth(...prev.split('-').map(Number))));
  const tot = (rows, type) => sum(rows.filter(t => t.type === type).map(t => t.amount));
  return {
    income: tot(cur, 'income'), expense: tot(cur, 'expense'),
    prevIncome: tot(before, 'income'), prevExpense: tot(before, 'expense'),
    inProgress,
  };
}

function categoryMovers(expenses, month, today) {
  const prev = shiftMonth(month, -1);
  const cutDay = monthKey(today) === month ? parseYMD(today).d : 31;
  const cur = {}, before = {};
  for (const t of expenses) {
    const c = t.category || 'Uncategorised', d = parseYMD(t.date).d;
    if (monthKey(t.date) === month) cur[c] = (cur[c] || 0) + t.amount;
    else if (monthKey(t.date) === prev && d <= cutDay) before[c] = (before[c] || 0) + t.amount;
  }
  const all = new Set([...Object.keys(cur), ...Object.keys(before)]);
  return [...all].map(c => ({ category: c, now: cur[c] || 0, before: before[c] || 0, delta: (cur[c] || 0) - (before[c] || 0) }));
}

function narrative({ month, today, transactions, expenses, anomalies, subs }) {
  const s = monthSummary(transactions, month, today);
  const label = monthLabel(month);
  const prevLabel = monthLabel(shiftMonth(month, -1));
  const bullets = [];

  let headline;
  if (!s.expense && !s.income) {
    headline = `No transactions recorded for ${label} yet.`;
  } else {
    const when = s.inProgress ? 'so far this month' : `in ${label}`;
    const vs = s.inProgress ? 'the same point last month' : prevLabel;
    if (!s.prevExpense) headline = `You've spent ${inr(s.expense)} ${when}.`;
    else {
      const pct = Math.round(((s.expense - s.prevExpense) / s.prevExpense) * 100);
      headline = Math.abs(pct) < 5
        ? `You've spent ${inr(s.expense)} ${when}, about the same as ${vs}.`
        : `You've spent ${inr(s.expense)} ${when}, ${Math.abs(pct)}% ${pct > 0 ? 'more' : 'less'} than ${vs}.`;
    }
  }

  if (s.income > 0) {
    const kept = s.income - s.expense;
    bullets.push(kept >= 0
      ? `Income ${inr(s.income)} and spending ${inr(s.expense)}: you kept ${inr(kept)} (${Math.round((kept / s.income) * 100)}% of income).`
      : `Income ${inr(s.income)} but spending ${inr(s.expense)}: you're ${inr(-kept)} over what you earned.`);
  }

  const movers = categoryMovers(expenses, month, today).filter(m => Math.abs(m.delta) >= MIN_SPIKE);
  const up = movers.filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta)[0];
  const down = movers.filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta)[0];
  const top = anomalies.categorySpikes[0];
  // the spike bullet below already says more about the same category
  if (up && !(top && top.category === up.category)) bullets.push(`${up.category} is up ${inr(up.delta)} (${inr(up.before)} to ${inr(up.now)}).`);
  if (down) bullets.push(`${down.category} is down ${inr(-down.delta)} (${inr(down.before)} to ${inr(down.now)}).`);

  if (top) bullets.push(`${top.category} is ${top.pct}% above its usual ${inr(top.average)} a month.`);
  else if (anomalies.outliers[0]) {
    const o = anomalies.outliers[0];
    bullets.push(`${inr(o.amount)} at ${o.merchant} is much larger than usual for ${o.category}.`);
  }
  if (anomalies.duplicates[0]) {
    const d = anomalies.duplicates[0];
    bullets.push(`${d.merchant} charged ${inr(d.amount)} twice within two days. Worth checking for a duplicate.`);
  }

  const active = subs.items.filter(i => i.status === 'active');
  if (active.length) bullets.push(`Recurring charges cost about ${inr(subs.monthlyTotal)} a month (${inr(subs.annualTotal)} a year) across ${active.length} payment${active.length === 1 ? '' : 's'}.`);
  const hike = subs.items.find(i => i.priceChange && i.priceChange.pct > 0);
  if (hike) bullets.push(`${hike.merchant} went up from ${inr(hike.priceChange.from)} to ${inr(hike.priceChange.to)}.`);
  const missing = subs.items.find(i => i.status === 'missing');
  if (missing) bullets.push(`${missing.merchant} hasn't charged since ${missing.lastDate}. It may have been cancelled or failed.`);

  return { headline, bullets: bullets.slice(0, 7), summary: s };
}

/**
 * @param {object} o
 * @param {string} o.today 'YYYY-MM-DD'
 * @param {string} o.month 'YYYY-MM'
 * @param {Array}  o.transactions [{date,type:'income'|'expense',amount,merchant,category}] (completed, no transfers)
 * @param {Array}  o.rules        active recurring rules [{name,amount}]
 */
function analyze({ today, month, transactions, rules = [] }) {
  const expenses = transactions.filter(t => t.type === 'expense');
  const subs = subscriptions(expenses, today, rules);
  const subKeys = new Set(subs.items.map(i => normalizeMerchant(i.merchant)));
  const nonSub = expenses.filter(t => !subKeys.has(normalizeMerchant(t.merchant)));

  const anomalies = {
    categorySpikes: categorySpikes(expenses, month),
    outliers: outliers(nonSub, month),
    duplicates: duplicates(nonSub, today),
  };
  const { headline, bullets, summary } = narrative({ month, today, transactions, expenses, anomalies, subs });
  return { month, monthLabel: monthLabel(month), headline, bullets, summary, anomalies, subscriptions: subs };
}

module.exports = { analyze, normalizeMerchant, categorySpikes, outliers, duplicates, subscriptions, monthSummary };
