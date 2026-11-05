// Upper bound for any single money amount (₹999 crore) — guards against typos and overflow.
const MAX_AMOUNT = 9999999999;

// Parses a money value; returns null unless it is a finite number within [min, MAX_AMOUNT].
const parseAmount = (v, { min = 0, allowZero = false } = {}) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n > MAX_AMOUNT) return null;
  if (allowZero ? n < min : n <= min) return null;
  return n;
};

// '' / undefined → null so Postgres DATE/optional columns don't choke on empty strings.
const blankToNull = v => (v === '' || v === undefined ? null : v);

module.exports = { MAX_AMOUNT, parseAmount, blankToNull };
