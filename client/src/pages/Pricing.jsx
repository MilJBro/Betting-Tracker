import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import CheckoutModal from '../components/CheckoutModal.jsx';
import PlanCards from '../components/PlanCards.jsx';
import { usePlan } from '../usePlan.js';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api.js';
import { useState } from 'react';

export default function Pricing() {
  const navigate = useNavigate();
  const toast = useToast();
  const { ent, refresh } = usePlan();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const isPro = ent?.pro;
  const billing = ent?.billing;

  // Returning from Stripe Checkout (?upgrade=success|cancelled).
  useEffect(() => {
    const u = params.get('upgrade');
    if (!u) return;
    if (u === 'success') { toast('Welcome to Pro — thanks for subscribing!', 'success'); refresh(); }
    else if (u === 'cancelled') toast('Checkout cancelled — no charge was made.');
    params.delete('upgrade');
    setParams(params, { replace: true });
  }, [params, setParams, refresh, toast]);

  async function doUpgrade() {
    if (billing?.enabled) { setShowCheckout(true); return; }
    // Billing not wired up yet (pre-launch) — flip the plan in dev if allowed.
    setBusy(true);
    try { await api.post('/plan/dev-set', { plan: 'pro' }); await refresh(); toast('You’re on Pro', 'success'); }
    catch (err) { toast(err.status === 403 ? 'Paid plans are coming soon.' : err.message, 'error'); }
    finally { setBusy(false); }
  }

  const priceLabel = billing?.priceLabel || '';
  const trialDays = billing?.trialDays || 0;

  return (
    <div className="main">
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <h1>Plans</h1>
          <p>Start free. Upgrade when you want more.</p>
        </div>
      </div>

      {isPro && (
        <div className="pro-banner">
          <span className="pb-ic"><Icon name="zap" size={18} /></span>
          <div><strong>You’re on Pro</strong><span className="muted"> — everything’s unlocked. Thank you!</span></div>
          <button className="btn-ghost btn-sm" onClick={() => navigate('/account')}>Manage</button>
        </div>
      )}

      <PlanCards
        priceLabel={priceLabel}
        freeButton={<button className="btn-ghost plan-cta" disabled>{isPro ? 'Included' : 'Your current plan'}</button>}
        proButton={isPro
          ? <button className="btn-primary plan-cta" disabled>Current plan</button>
          : <button className="btn-primary plan-cta" onClick={doUpgrade} disabled={busy || !ent}>
              {busy ? 'Working…' : trialDays > 0 ? `Start ${trialDays}-day free trial` : 'Upgrade to Pro'}
            </button>}
        proFine={!isPro && trialDays > 0 && priceLabel
          ? <p className="muted plan-fine">Free for {trialDays} days, then {priceLabel}. Cancel anytime.</p>
          : null}
      />

      <p className="muted" style={{ textAlign: 'center', fontSize: 12.5, marginTop: 18 }}>
        No ads · Cancel anytime · Please gamble responsibly · 18+
      </p>

      {showCheckout && <CheckoutModal publishableKey={billing?.publishableKey} onClose={() => setShowCheckout(false)} />}
    </div>
  );
}
