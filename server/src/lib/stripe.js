import Stripe from 'stripe';
import { config } from './config.js';
import { db } from './db.js';

// A single Stripe client, or null when billing isn't configured. Every caller
// must handle the null case so the app runs without Stripe.
export const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;

export const billingEnabled = config.billingEnabled;

// Cancel every live subscription on a customer, immediately. Used when an
// account is deleted so nobody keeps being billed for an account that no longer
// exists. Throws if Stripe refuses, so the caller can stop rather than orphan a
// subscription. Returns how many were cancelled.
export async function cancelAllSubscriptions(customerId, client = stripe) {
  if (!client || !customerId) return 0;
  let cancelled = 0;
  for await (const sub of client.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })) {
    if (sub.status === 'canceled' || sub.status === 'incomplete_expired') continue;
    await client.subscriptions.cancel(sub.id);
    cancelled++;
  }
  return cancelled;
}

// Find (or lazily create) the Stripe customer for a user and remember its id.
export async function ensureCustomer(userId) {
  const row = db.prepare('SELECT id, email, username, stripe_customer_id FROM users WHERE id = ?').get(userId);
  if (!row) throw new Error('User not found');
  if (row.stripe_customer_id) {
    // A saved id can become stale — e.g. it was created under a different
    // Stripe key/mode (test vs live) before the account went live, so the
    // current key can't find it and checkout fails with "No such customer".
    // Verify it still exists; if not, fall through and create a fresh one.
    try {
      const existing = await stripe.customers.retrieve(row.stripe_customer_id);
      if (existing && !existing.deleted) return row.stripe_customer_id;
    } catch (err) {
      if (err?.code !== 'resource_missing') throw err;
    }
  }
  const customer = await stripe.customers.create({
    email: row.email,
    name: row.username,
    metadata: { userId: row.id },
  });
  db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customer.id, userId);
  return customer.id;
}

// Work out the dates that matter on a subscription: when it ends or renews,
// and whether it's set to cancel. Stripe has moved current_period_end from the
// subscription onto its items in newer API versions, so read either.
export function describeSubscription(sub) {
  if (!sub) return { endsAt: null, cancelling: false };
  const item = sub.items?.data?.[0];
  const periodEnd = sub.current_period_end || item?.current_period_end || null;
  const cancelling = !!(sub.cancel_at_period_end || sub.cancel_at);
  const trialEnd = sub.status === 'trialing' ? sub.trial_end : null;
  const endsAt = (cancelling && sub.cancel_at) || trialEnd || periodEnd || null;
  return { endsAt: endsAt ? Number(endsAt) : null, cancelling };
}

// Map a Stripe subscription status onto our plan and apply it to the user that
// owns the given customer id. Called from the webhook and the billing sync.
export function applySubscriptionState(customerId, status, sub = null) {
  const row = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(customerId);
  if (!row) return;
  const active = ['active', 'trialing', 'past_due'].includes(status);
  if (!sub) { // status only (e.g. checkout just completed): keep the dates we have
    db.prepare('UPDATE users SET plan = ?, sub_status = ? WHERE id = ?').run(active ? 'pro' : 'free', active ? status : 'canceled', row.id);
    return;
  }
  const { endsAt, cancelling } = active ? describeSubscription(sub) : { endsAt: null, cancelling: false };
  db.prepare('UPDATE users SET plan = ?, sub_status = ?, sub_ends_at = ?, sub_cancelling = ? WHERE id = ?')
    .run(active ? 'pro' : 'free', active ? status : 'canceled', endsAt, cancelling ? 1 : 0, row.id);
}
