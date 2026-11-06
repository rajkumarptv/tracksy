// Debt payoff maths for the Payoff planner / coach. Pure functions: no React, no network.

export const DEBT_TYPES = [
  'visa', 'mastercard', 'loan', 'home_loan', 'vehicle_loan', 'personal_loan',
  'gold_loan', 'education_loan', 'bnpl', 'family_borrow', 'emi',
];
const CARD_TYPES = ['visa', 'mastercard'];
export const DEFAULT_RATE = 18;      // % p.a., only used when a debt has no rate set (flagged via rateAssumed)
const MAX_MONTHS = 600;

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

/** Wallet rows -> debts to pay off. Lending/asset wallets are money owed *to* the user, so they are excluded. */
export function normalizeDebts(wallets) {
  return (wallets || [])
    .filter(w => DEBT_TYPES.includes(w.type) && Math.abs(num(w.balance)) > 0.5)
    .map(w => {
      const rate = num(w.interest_rate);
      return {
        id: w.id,
        name: w.name,
        type: w.type,
        isCard: CARD_TYPES.includes(w.type),
        balance: Math.abs(num(w.balance)),
        rate: rate > 0 ? rate : DEFAULT_RATE,
        rateAssumed: !(rate > 0),
        emi: num(w.emi_amount),
        creditLimit: num(w.credit_limit),
        paymentDay: w.payment_day ? parseInt(w.payment_day, 10) : null,
        emiDay: w.emi_day ? parseInt(w.emi_day, 10) : null,
      };
    });
}

export const monthlyInterest = d => d.balance * (d.rate / 100 / 12);

/** Required monthly payment: the EMI when known, otherwise a typical card minimum (never below interest + 1%). */
export function minPayment(d) {
  if (d.emi > 0) return d.emi;
  return Math.max(d.balance * 0.02, monthlyInterest(d) + d.balance * 0.01, 100);
}

const addMonthsYM = (from, n) => {
  const t = from.getFullYear() * 12 + from.getMonth() + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};

/**
 * Month-by-month payoff simulation.
 * Each month: interest accrues, every debt gets its minimum, then the leftover budget
 * (extra + minimums freed by finished debts) goes to the priority debt.
 * method: 'avalanche' (highest rate first) | 'snowball' (smallest balance first).
 */
export function simulate(debts, { extra = 0, method = 'avalanche', today = new Date() } = {}) {
  const items = debts.map(d => ({
    id: d.id, name: d.name, rate: d.rate,
    bal: d.balance, mr: d.rate / 100 / 12, min: minPayment(d),
    interestPaid: 0, payoffMonth: null, initial: d.balance,
  }));
  const budget = items.reduce((s, d) => s + d.min, 0) + extra;
  const priority = [...items].sort((a, b) =>
    method === 'snowball' ? a.initial - b.initial : (b.rate - a.rate) || (a.initial - b.initial));

  const series = [{ month: 0, balance: items.reduce((s, d) => s + d.bal, 0) }];
  let month = 0;
  let totalInterest = 0;

  while (items.some(d => d.bal > 0.005) && month < MAX_MONTHS) {
    month++;
    for (const d of items) {
      if (d.bal <= 0.005) continue;
      const i = d.bal * d.mr;
      d.bal += i; d.interestPaid += i; totalInterest += i;
    }
    let pool = budget;
    for (const d of items) {                       // minimums first
      if (d.bal <= 0.005) continue;
      const pay = Math.min(d.min, d.bal, pool);
      d.bal -= pay; pool -= pay;
    }
    for (const d of priority) {                    // everything left goes down the priority list
      if (pool <= 0.005) break;
      if (d.bal <= 0.005) continue;
      const pay = Math.min(pool, d.bal);
      d.bal -= pay; pool -= pay;
    }
    for (const d of items) if (d.bal <= 0.005 && d.payoffMonth === null) { d.bal = 0; d.payoffMonth = month; }
    if (month <= 60 || month % 3 === 0) series.push({ month, balance: items.reduce((s, d) => s + d.bal, 0) });
  }

  const neverPaysOff = items.some(d => d.bal > 0.005);
  const order = priority.map(d => ({
    id: d.id, name: d.name, rate: d.rate,
    payoffMonth: d.payoffMonth,
    payoffDate: d.payoffMonth ? addMonthsYM(today, d.payoffMonth) : null,
    interestPaid: d.interestPaid,
  })).sort((a, b) => (a.payoffMonth ?? Infinity) - (b.payoffMonth ?? Infinity));

  return {
    method, extra, neverPaysOff,
    months: neverPaysOff ? null : month,
    debtFreeDate: neverPaysOff ? null : addMonthsYM(today, month),
    totalInterest, series, order,
  };
}

/** How much each extra monthly amount saves compared with paying only the minimums. */
export function whatIf(debts, method = 'avalanche', amounts = [1000, 2000, 5000], today = new Date()) {
  const base = simulate(debts, { extra: 0, method, today });
  return amounts.map(extra => {
    const r = simulate(debts, { extra, method, today });
    return {
      extra, months: r.months, totalInterest: r.totalInterest,
      interestSaved: base.neverPaysOff ? null : base.totalInterest - r.totalInterest,
      monthsSaved: base.neverPaysOff || r.neverPaysOff ? null : base.months - r.months,
    };
  });
}

/** Days until the next occurrence of day-of-month `day` (clamped to short months). */
export function daysUntilDay(day, today = new Date()) {
  const y = today.getFullYear(), m = today.getMonth();
  const at = (yy, mm) => new Date(yy, mm, Math.min(day, new Date(yy, mm + 1, 0).getDate()));
  const start = new Date(y, m, today.getDate());
  let next = at(y, m);
  if (next < start) next = at(y, m + 1);
  return Math.round((next - start) / 86400000);
}

const defaultFmt = n => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Plain-language, deterministic advice. Level: 'warn' | 'good' | 'info'. */
export function coachTips(debts, result, whatIfRows = [], { fmt = defaultFmt, today = new Date() } = {}) {
  const tips = [];
  if (!debts.length) return tips;

  if (result.neverPaysOff) {
    tips.push({
      level: 'warn', title: 'Your payments do not cover the interest',
      body: 'At the current minimums your debt never reaches zero. Add an extra monthly payment or raise your EMI.',
    });
  }

  const target = result.method === 'snowball'
    ? debts.reduce((a, b) => (a.balance <= b.balance ? a : b))
    : debts.reduce((a, b) => (a.rate >= b.rate ? a : b));
  if (target) {
    tips.push({
      level: 'info', title: `Pay ${target.name} first`,
      body: `${target.rate}% p.a. means about ${fmt(monthlyInterest(target))} of interest every month on ${fmt(target.balance)}.`,
    });
  }

  const best = whatIfRows.find(r => r.monthsSaved && r.monthsSaved >= 1 && r.interestSaved > 0);
  if (best) {
    tips.push({
      level: 'good', title: `An extra ${fmt(best.extra)} a month makes a real difference`,
      body: `You'd be debt-free ${best.monthsSaved} month${best.monthsSaved === 1 ? '' : 's'} sooner and save ${fmt(best.interestSaved)} in interest.`,
    });
  }

  for (const d of debts) {
    if (d.isCard && d.creditLimit > 0) {
      const util = (d.balance / d.creditLimit) * 100;
      if (util >= 30) {
        tips.push({
          level: 'warn', title: `${d.name} is ${Math.round(util)}% used`,
          body: 'Using more than 30% of a card limit can hurt your credit score. Paying it down first helps.',
        });
      }
    }
    const day = d.isCard ? d.paymentDay : d.emiDay;
    if (day) {
      const left = daysUntilDay(day, today);
      if (left <= 7) {
        tips.push({
          level: 'info', title: `${d.name} ${d.isCard ? 'payment' : 'EMI'} due ${left === 0 ? 'today' : `in ${left} day${left === 1 ? '' : 's'}`}`,
          body: d.isCard ? 'Pay at least the minimum to avoid late fees.' : `Keep ${fmt(d.emi || minPayment(d))} ready in your account.`,
        });
      }
    }
  }

  const assumed = debts.filter(d => d.rateAssumed);
  if (assumed.length) {
    tips.push({
      level: 'info', title: `${assumed.length} debt${assumed.length === 1 ? ' has' : 's have'} no interest rate set`,
      body: `We assumed ${DEFAULT_RATE}% p.a. for ${assumed.map(d => d.name).join(', ')}. Add the real rate for accurate numbers.`,
    });
  }
  return tips;
}
