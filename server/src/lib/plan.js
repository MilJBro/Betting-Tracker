import { db } from './db.js';

// --- Plans & entitlements ---------------------------------------------------
// The single source of truth for the free/Pro boundary. Feature gating must go
// through here (server-side) — never trust the client to enforce it.

export const PLANS = ['free', 'pro'];

// How many bet-slip scans a free account may run per calendar month. Each scan
// is a paid vision call, so this is the lever that keeps costs aligned with
// revenue. Pro is unlimited.
export const FREE_SCAN_LIMIT = Number(process.env.FREE_SCAN_LIMIT) || 5;

// Features reserved for Pro. Referenced by the client to show lock badges and
// by the server's requirePro middleware. (Basic tracking stays free.)
export const PRO_FEATURES = [
  'unlimited-scans',
  'advanced-analytics', // date ranges, filtered breakdowns, bankroll growth
  'csv',                // import / export
  'custom-share',       // remove badge, custom link
];

function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

function getUserRow(userId) {
  return db
    .prepare('SELECT id, plan, scan_month, scan_count FROM users WHERE id = ?')
    .get(userId);
}

export function getPlan(userId) {
  const row = getUserRow(userId);
  return row && PLANS.includes(row.plan) ? row.plan : 'free';
}

export function isPro(userId) {
  return getPlan(userId) === 'pro';
}

// Scans already used in the current month (0 once the month rolls over).
function scansUsed(row) {
  if (!row) return 0;
  return row.scan_month === monthKey() ? row.scan_count || 0 : 0;
}

// A serialisable snapshot of what a user is entitled to — shipped to the client
// so it can show usage and lock badges (never as the enforcement boundary).
export function entitlements(userId) {
  const row = getUserRow(userId);
  const plan = row && PLANS.includes(row.plan) ? row.plan : 'free';
  const pro = plan === 'pro';
  const used = scansUsed(row);
  return {
    plan,
    pro,
    features: pro ? PRO_FEATURES : [],
    scans: {
      used,
      limit: pro ? null : FREE_SCAN_LIMIT,
      remaining: pro ? null : Math.max(0, FREE_SCAN_LIMIT - used),
      unlimited: pro,
    },
  };
}

// True if the user may run another scan right now.
export function canScan(userId) {
  const e = entitlements(userId);
  return e.scans.unlimited || e.scans.remaining > 0;
}

// Record one scan against the monthly counter (call only after a successful
// scan so failures don't burn quota). Resets the window when the month rolls.
export function recordScan(userId) {
  const row = getUserRow(userId);
  const mk = monthKey();
  if (!row || row.scan_month !== mk) {
    db.prepare('UPDATE users SET scan_month = ?, scan_count = 1 WHERE id = ?').run(mk, userId);
  } else {
    db.prepare('UPDATE users SET scan_count = scan_count + 1 WHERE id = ?').run(userId);
  }
}

export function setPlan(userId, plan) {
  if (!PLANS.includes(plan)) throw new Error('Unknown plan');
  db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, userId);
  return getPlan(userId);
}

// Express middleware to gate a Pro-only route. 402 Payment Required is the
// conventional status for "this needs a paid plan".
export function requirePro(req, res, next) {
  if (isPro(req.userId)) return next();
  return res.status(402).json({
    error: 'This is a Pro feature. Upgrade to unlock it.',
    upgrade: true,
  });
}
