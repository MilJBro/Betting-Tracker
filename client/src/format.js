const CURRENCY_SYMBOLS = { GBP: '£', USD: '$', EUR: '€', AUD: 'A$', CAD: 'C$' };

export function currencySymbol(code) {
  return CURRENCY_SYMBOLS[code] || '£';
}

export function money(amount, currency = 'GBP', { signed = false } = {}) {
  if (amount == null) return '—';
  const sym = currencySymbol(currency);
  const sign = signed && amount > 0 ? '+' : amount < 0 ? '-' : '';
  const val = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${sym}${val}`;
}

// Format a units value like "2u", "+1.5u", "-3u" (up to 2 dp, trailing zeros
// trimmed). The user defines what a unit is worth.
export function units(u, { signed = false } = {}) {
  if (u == null || !Number.isFinite(u)) return '—';
  const sign = signed && u > 0 ? '+' : u < 0 ? '-' : '';
  const val = Math.round(Math.abs(u) * 100) / 100;
  return `${sign}${val}u`;
}

// Format a monetary amount according to the user's staking preference:
// currency (£), units (Nu), or both. `unitSize` is the £ value of 1 unit.
export function formatStake(amount, currency = 'GBP', staking, opts = {}) {
  if (amount == null) return '—';
  const mode = staking?.mode || 'currency';
  const size = Number(staking?.unitSize) || 0;
  if (mode === 'currency' || size <= 0) return money(amount, currency, opts);
  const u = units(amount / size, opts);
  if (mode === 'units') return u;
  return `${money(amount, currency, opts)} · ${u}`;
}

// Convert a stored decimal odds value into the user's preferred format.
export function formatOdds(decimal, format = 'decimal') {
  const d = Number(decimal);
  if (!Number.isFinite(d) || d <= 0) return '—';
  if (format === 'decimal') return d.toFixed(2);
  if (format === 'american') {
    if (d >= 2) return `+${Math.round((d - 1) * 100)}`;
    return `${Math.round(-100 / (d - 1))}`;
  }
  if (format === 'fractional') {
    const num = d - 1;
    // Approximate a tidy fraction.
    let bestN = 1, bestD = 1, bestErr = Infinity;
    for (let den = 1; den <= 50; den++) {
      const n = Math.round(num * den);
      const err = Math.abs(num - n / den);
      if (err < bestErr) { bestErr = err; bestN = n; bestD = den; }
    }
    const g = gcd(bestN, bestD);
    return `${bestN / g}/${bestD / g}`;
  }
  return d.toFixed(2);
}

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}
