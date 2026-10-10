import { db } from './db.js';
import { config } from './config.js';
import { isAdminEmail } from './admin.js';

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
    .prepare('SELECT id, email, plan, scan_month, scan_count, sub_status, sub_ends_at, sub_cancelling, trial_used FROM users WHERE id = ?')
    .get(userId);
}

// Owners (ADMIN_EMAILS) always have Pro, whatever Stripe says — so the site's
// own accounts never lose Pro when a test subscription lapses.
function effectivePlan(row) {
  if (!row) return 'free';
  if (isAdminEmail(row.email)) return 'pro';
  return PLANS.includes(row.plan) ? row.plan : 'free';
}

export function getPlan(userId) {
  return effectivePlan(getUserRow(userId));
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
  const plan = effectivePlan(row);
  const pro = plan === 'pro';
  const paid = row?.plan === 'pro';
  const used = scansUsed(row);
  return {
    plan,
    pro,
    features: pro ? PRO_FEATURES : [],
    // True when Pro comes from being an owner rather than from a subscription.
    comped: pro && !paid && isAdminEmail(row?.email),
    // Where the Stripe subscription stands (null until Stripe has told us).
    subscription: pro && row?.sub_status
      ? {
          status: row.sub_status,
          trialing: row.sub_status === 'trialing',
          cancelling: !!row.sub_cancelling,
          endsAt: row.sub_ends_at ? row.sub_ends_at * 1000 : null,
        }
      : null,
    // Whether AI-powered bet-slip scanning is configured on the server.
    ai: { enabled: !!config.anthropic.apiKey },
    scans: {
      used,
      limit: pro ? null : FREE_SCAN_LIMIT,
      remaining: pro ? null : Math.max(0, FREE_SCAN_LIMIT - used),
      unlimited: pro,
    },
    billing: {
      enabled: config.billingEnabled,
      priceLabel: config.stripe.priceLabel || '',
      priceLabelAnnual: config.stripe.priceLabelAnnual || '',
      annualSave: config.stripe.annualSave || '',
      // Whether the yearly plan can actually be checked out yet.
      annualEnabled: !!config.stripe.priceIdAnnual,
      // Public key so the client can load Stripe.js for the on-site checkout.
      // Never expose the secret key here.
      publishableKey: config.stripe.publishableKey || '',
      // The free trial is once per account, so someone who has already had a
      // subscription sees no trial offer.
      trialDays: row?.trial_used ? 0 : config.stripe.trialDays || 0,
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
