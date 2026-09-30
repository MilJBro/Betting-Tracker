import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api.js';

// Starts Stripe-hosted Checkout. We ask the server to create a Checkout Session
// and send the browser to Stripe's secure payment page; Stripe redirects back
// to the Account page (?upgrade=success|cancelled) when it's done. Card details
// never touch our server. Shown as a small overlay so there's clear feedback
// during the hop out to Stripe. `publishableKey` is accepted (and ignored) so
// existing call sites keep working — hosted Checkout needs no Stripe.js.
export default function CheckoutModal({ interval = 'monthly', onClose }) {
  const started = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Guard against React StrictMode's double-invoke so we only create one
    // Checkout Session and redirect once.
    if (started.current) return;
    started.current = true;
    let cancelled = false;

    (async () => {
      try {
        const { url } = await api.post('/billing/checkout', { interval });
        if (cancelled) return;
        if (!url) throw new Error('Could not start checkout. Please try again.');
        window.location.assign(url);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not start checkout. Please try again.');
      }
    })();

    return () => { cancelled = true; };
  }, [interval]);

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
          <div className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>
            Taking you to secure checkout…
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
