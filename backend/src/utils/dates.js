// Calendar-date helpers shared by recurring processing and the cash-flow forecast.
// Dates are handled as 'YYYY-MM-DD' strings. pg returns DATE columns as local-midnight
// Date objects, so Date inputs are read with local parts (toISOString would shift a day).

const pad = n => String(n).padStart(2, '0');

const toYMD = d => {
  if (typeof d === 'string') return d.slice(0, 10);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const parseYMD = s => {
  const [y, m, d] = toYMD(s).split('-').map(Number);
  return { y, m, d };
};

const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-12

// Adds one period to a date. `anchorDay` is the original day-of-month so a monthly rule
// that started on the 31st lands on the 31st (or month end) every month instead of drifting
// down after a short month: Jan 31 -> Feb 28 -> Mar 31.
function addPeriod(from, frequency, anchorDay) {
  const { y, m, d } = parseYMD(from);
  const day = anchorDay || d;
  if (frequency === 'daily' || frequency === 'weekly') {
    const step = frequency === 'daily' ? 1 : 7;
    const t = new Date(Date.UTC(y, m - 1, d + step));
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  }
  const months = frequency === 'yearly' ? 12 : 1;
  const total = (y * 12 + (m - 1)) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(day, daysInMonth(ny, nm)))}`;
}

// Day-of-month `day` in the given month, clamped to the month end (e.g. EMI day 31 in June -> 30).
const dayInMonth = (y, m, day) => `${y}-${pad(m)}-${pad(Math.min(day, daysInMonth(y, m)))}`;

const addDays = (from, n) => {
  const { y, m, d } = parseYMD(from);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

const diffDays = (a, b) => {
  const pa = parseYMD(a), pb = parseYMD(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
};

const weekday = s => { const { y, m, d } = parseYMD(s); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

module.exports = { toYMD, parseYMD, addPeriod, addDays, diffDays, dayInMonth, daysInMonth, weekday };
