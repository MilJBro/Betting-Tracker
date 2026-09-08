import { config } from '../lib/config.js';
import { stripe, applySubscriptionState } from '../lib/stripe.js';
import { setPlan } from '../lib/plan.js';
import { db } from '../lib/db.js';

// Stripe webhook. Mounted with a RAW body parser (signature verification needs
// the exact bytes), so this must be registered before the global JSON parser.
export async function stripeWebhook(req, res) {
  if (!stripe || !config.stripe.webhookSecret) return res.status(400).send('Billing not configured');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripe.webhookSecret);
  } catch (err) {
    console.error('webhook signature check failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        // Prefer the user we referenced; fall back to the customer mapping.
        const userId = s.client_reference_id;
        if (userId) {
          if (s.customer) {
            db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(s.customer, userId);
          }
          setPlan(userId, 'pro');
        } else if (s.customer) {
          applySubscriptionState(s.customer, 'active');
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        // A deleted/canceled subscription reports a terminal status here.
        const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status;
        applySubscriptionState(sub.customer, status);
        break;
      }
      default:
        break; // ignore other events
    }
  } catch (err) {
    console.error('webhook handling error', err.message);
    // Return 200 so Stripe doesn't retry a bug forever; we've logged it.
  }
  res.json({ received: true });
}
