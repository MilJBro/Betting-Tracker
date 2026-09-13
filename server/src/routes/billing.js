import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { config } from '../lib/config.js';
import { isPro } from '../lib/plan.js';
import { stripe, billingEnabled, ensureCustomer } from '../lib/stripe.js';

const router = Router();
router.use(requireAuth);

function notConfigured(res) {
  return res.status(400).json({ error: 'Billing is not set up yet.' });
}

// Start a Stripe Checkout session for the Pro subscription. Uses embedded UI
// mode so the payment form renders inside our own page (Stripe.js mounts it in
// an iframe) rather than redirecting away; returns the session client secret.
router.post('/checkout', async (req, res) => {
  if (!billingEnabled) return notConfigured(res);
  if (isPro(req.userId)) return res.status(400).json({ error: 'You already have Pro.' });
  try {
    const customer = await ensureCustomer(req.userId);
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'subscription',
      customer,
      line_items: [{ price: config.stripe.priceId, quantity: 1 }],
      client_reference_id: req.userId,
      allow_promotion_codes: true,
      // After payment Stripe returns the top window here; the Account page reads
      // ?upgrade=success to show the confirmation and refresh the plan.
      return_url: `${config.appUrl}/account?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
    });
    res.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error('checkout error', err.message);
    res.status(502).json({ error: 'Could not start checkout. Please try again.' });
  }
});

// Open the Stripe customer portal so a Pro user can manage or cancel.
router.post('/portal', async (req, res) => {
  if (!billingEnabled) return notConfigured(res);
  try {
    const customer = await ensureCustomer(req.userId);
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${config.appUrl}/account`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('portal error', err.message);
    res.status(502).json({ error: 'Could not open the billing portal. Please try again.' });
  }
});

export default router;
