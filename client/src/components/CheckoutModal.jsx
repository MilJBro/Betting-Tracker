import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadStripe } from '@stripe/stripe-js';
import { api } from '../api.js';

// Stripe.js is loaded once (from js.stripe.com) and reused. loadStripe returns
// a promise, so we keep the promise, not the resolved value.
let stripePromise = null;
function getStripe(pk) {
  if (!stripePromise) stripePromise = loadStripe(pk);
  return stripePromise;
}

// The Pro upgrade checkout, rendered inside our own page. Stripe's embedded
// Checkout mounts a secure iframe here (card details never touch our server).
// Portalled to <body> so the overlay scrolls reliably on iOS, like our other
// sheets. On success Stripe redirects the top window to the return_url, which
// the Account page handles (?upgrade=success).
export default function CheckoutModal({ publishableKey, onClose }) {
  const mountRef = useRef(null);
  const checkoutRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!publishableKey) {
        setError('Payments aren’t fully configured yet. Please try again later.');
        setLoading(false);
        return;
      }
      try {
        const stripe = await getStripe(publishableKey);
        if (!stripe) throw new Error('Could not load the payment form.');
        // Create the checkout session up front so any server-side error (e.g. a
        // Stripe misconfiguration) surfaces in our own error banner. If we let
        // Stripe's fetchClientSecret callback make this call, a failure there is
        // replaced by Stripe's generic "Something went wrong" and the real
        // reason is lost.
        const { clientSecret } = await api.post('/billing/checkout');
        if (!clientSecret) throw new Error('Could not start checkout. Please try again.');
        if (cancelled) return;
        const checkout = await stripe.initEmbeddedCheckout({
          fetchClientSecret: async () => clientSecret,
        });
        if (cancelled) { checkout.destroy(); return; }
        checkoutRef.current = checkout;
        checkout.mount(mountRef.current);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not start checkout. Please try again.');
          setLoading(false);
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      try { checkoutRef.current?.destroy(); } catch {}
    };
  }, [publishableKey]);

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row spread" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Upgrade to Pro</h2>
          <button className="btn-ghost btn-sm" type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {error ? (
          <div className="error-banner">{error}</div>
        ) : (
          <>
            {loading && <div className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>Loading payment form…</div>}
            <div ref={mountRef} />
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
