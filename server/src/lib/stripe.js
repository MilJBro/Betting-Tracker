import Stripe from 'stripe';
import { config } from './config.js';
import { db } from './db.js';

// A single Stripe client, or null when billing isn't configured. Every caller
// must handle the null case so the app runs without Stripe.
export const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;

export const billingEnabled = config.billingEnabled;

// Find (or lazily create) the Stripe customer for a user and remember its id.
export async function ensureCustomer(userId) {
  const row = db.prepare('SELECT id, email, username, stripe_customer_id FROM users WHERE id = ?').get(userId);
  if (!row) throw new Error('User not found');
  if (row.stripe_customer_id) return row.stripe_customer_id;
  const customer = await stripe.customers.create({
    email: row.email,
    name: row.username,
    metadata: { userId: row.id },
  });
  db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customer.id, userId);
  return customer.id;
}

// Map a Stripe subscription status onto our plan and apply it to the user that
// owns the given customer id. Called from the webhook.
export function applySubscriptionState(customerId, status) {
  const row = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(customerId);
  if (!row) return;
  const active = ['active', 'trialing', 'past_due'].includes(status);
  db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(active ? 'pro' : 'free', row.id);
}
