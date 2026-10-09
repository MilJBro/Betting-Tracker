import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { config } from '../lib/config.js';
import { isPro, entitlements } from '../lib/plan.js';
import { stripe, billingEnabled, ensureCustomer, applySubscriptionState } from '../lib/stripe.js';

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
  // Yearly plan when requested. The label may show a yearly price before the
  // Stripe annual price exists — block checkout in that window rather than
  // silently charging the monthly price.
  const wantAnnual = (req.body?.interval || '') === 'annual';
  if (wantAnnual && !config.stripe.priceIdAnnual) {
    return res.status(400).json({ error: 'The yearly plan isn’t quite ready yet — please choose monthly for now.' });
  }
  const price = wantAnnual ? config.stripe.priceIdAnnual : config.stripe.priceId;
  try {
    const customer = await ensureCustomer(req.userId);
    // One free trial per account: skip it if we've seen a subscription before,
    // or Stripe has any on this customer (covers a missed webhook).
    let trialDays = entitlements(req.userId).billing.trialDays;
    if (trialDays > 0) {
      const prior = await stripe.subscriptions.list({ customer, status: 'all', limit: 1 });
      if (prior.data.length > 0) trialDays = 0;
    }
    const session = await stripe.checkout.sessions.create({
      // Embedded Checkout mounts the payment form inside our own page (card
      // details go straight to Stripe in an iframe, never our server), so the
      // customer stays in the app. Stripe's newer API versions renamed this mode
      // 'embedded' -> 'embedded_page', paired with stripe.createEmbeddedCheckoutPage()
      // on the client.
      ui_mode: 'embedded_page',
      mode: 'subscription',
      customer,
      line_items: [{ price, quantity: 1 }],
      client_reference_id: req.userId,
      allow_promotion_codes: true,
      // Free trial before the first charge (card still collected up front, then
      // billed automatically when the trial ends unless they cancel).
      ...(trialDays > 0
        ? { subscription_data: { trial_period_days: trialDays } }
        : {}),
      // After a successful payment Stripe redirects the top window here; the
      // Account page reads ?upgrade=success to confirm and refresh the plan.
      return_url: `${config.appUrl}/account?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
    });
    res.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error('checkout error', err.type, err.message);
    // Surface Stripe's own request-validation message (safe, user-facing text)
    // so misconfigurations are diagnosable; keep other errors generic.
    const msg = err.type === 'StripeInvalidRequestError' && err.message
      ? err.message
      : 'Could not start checkout. Please try again.';
    res.status(502).json({ error: msg });
  }
});

// Open the Stripe customer portal so a Pro user can manage or cancel.
router.post('/portal', async (req, res) => {
  if (!billingEnabled) return notConfigured(res);
  try {
    const customer = await ensureCustomer(req.userId);
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${config.appUrl}/account?billing=updated`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('portal error', err.message);
    res.status(502).json({ error: 'Could not open the billing portal. Please try again.' });
  }
});

// Pull the subscription straight from Stripe and apply it. The webhook normally
// does this, but syncing on return from checkout/the portal means the Plan card
// is right immediately even if a webhook is late.
router.post('/sync', async (req, res) => {
  if (!billingEnabled) return res.json({ ok: true });
  try {
    const customer = await ensureCustomer(req.userId);
    let best = null;
    for await (const sub of stripe.subscriptions.list({ customer, status: 'all', limit: 10 })) {
      if (['active', 'trialing', 'past_due'].includes(sub.status)) { best = sub; break; }
      if (!best) best = sub;
    }
    if (best) applySubscriptionState(customer, best.status, best);
    res.json({ ok: true });
  } catch (err) {
    console.error('billing sync error', err.message);
    res.status(502).json({ error: 'Could not refresh your subscription.' });
  }
});

export default router;
