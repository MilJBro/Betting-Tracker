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

// The unit size in force on a given day. The server keeps a dated history
// (staking.unitHistory, oldest first) so past bets keep the unit size they were
// placed under; with no history this is just the current size. Mirrors the
// server's lib/units.js.
export function unitSizeAt(staking, when) {
  const hist = Array.isArray(staking?.unitHistory) ? staking.unitHistory : [];
  const current = Number(staking?.unitSize) || 0;
  if (!hist.length) return current;
  const day = String(when || '').slice(0, 10);
  let size = Number(hist[0].size) || current;
  for (const e of hist) if (e.from && day >= e.from) size = Number(e.size) || size;
  return size;
}

// A copy of a bet list with stakes/payouts re-expressed in units (each bet at
// the unit size it was placed under). Profit is linear in stake and payout, so
// running the usual metrics over this gives unit totals that add up bet by bet.
export function toUnitBets(list, staking) {
  return list.map((b) => {
    const u = unitSizeAt(staking, b.placed_at);
    if (!(u > 0)) return { ...b, stake: 0, payout: b.payout == null ? b.payout : 0 };
    return { ...b, stake: b.stake / u, payout: b.payout == null || b.payout === '' ? b.payout : b.payout / u };
  });
}

// How an amount is expressed in units. Pass `units` for a figure already summed
// in units (totals); `at` (a bet's date) to use the size that applied then;
// otherwise the current size.
function unitValue(amount, staking, opts) {
  if (opts.units != null) return Number.isFinite(Number(opts.units)) ? Number(opts.units) : null;
  const size = opts.at ? unitSizeAt(staking, opts.at) : Number(staking?.unitSize) || 0;
  return size > 0 ? amount / size : null;
}

// Format a monetary amount according to the user's staking preference:
// currency (£), units (Nu), or both.
export function formatStake(amount, currency = 'GBP', staking, opts = {}) {
  if (amount == null) return '—';
  const mode = staking?.mode || 'currency';
  const uv = mode === 'currency' ? null : unitValue(amount, staking, opts);
  if (uv == null) return money(amount, currency, opts);
  const u = units(uv, opts);
  if (mode === 'units') return u;
  return `${money(amount, currency, opts)} · ${u}`;
}

// An amount split into a main figure and an optional smaller second figure,
// following the user's "Show stakes & profit as" setting:
//   Money -> money only        Units -> units first, money second
//   Both  -> money first, units second
// With no unit size set it is always money. Every screen uses this so changing
// the setting (or the unit size) changes them all together.
export function amountParts(amount, currency = 'GBP', staking, opts = {}) {
  if (amount == null) return { main: '—', sub: null };
  const mode = staking?.mode || 'currency';
  const m = money(amount, currency, opts);
  const uv = mode === 'currency' ? null : unitValue(amount, staking, opts);
  if (uv == null) return { main: m, sub: null };
  const u = units(uv, opts);
  return mode === 'units' ? { main: u, sub: m } : { main: m, sub: u };
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

// Parse odds the user typed in their chosen format into a decimal number.
// Fractional "5/2" -> 3.5; American "+150"/"-200" -> 2.5/1.5; decimal as-is.
export function parseOdds(str, format = 'decimal') {
  const s = String(str == null ? '' : str).trim();
  if (!s) return 0;
  if (format === 'fractional') {
    const m = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (m) { const den = Number(m[2]); return den ? 1 + Number(m[1]) / den : 0; }
    const n = Number(s); return Number.isFinite(n) ? n : 0; // no slash: treat as decimal
  }
  if (format === 'american') {
    const a = Number(s.replace(/^\+/, ''));
    if (!Number.isFinite(a) || a === 0) return 0;
    return a > 0 ? 1 + a / 100 : 1 + 100 / Math.abs(a);
  }
  const d = Number(s);
  return Number.isFinite(d) ? d : 0;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}
