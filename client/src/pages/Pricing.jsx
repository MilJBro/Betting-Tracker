import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import CheckoutModal from '../components/CheckoutModal.jsx';
import { usePlan } from '../usePlan.js';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api.js';
import { useState } from 'react';

// What each plan includes. Free is deliberately generous (the habit-forming
// core); Pro unlocks scale + deeper insight. Keep this in sync with the
// server's PRO_FEATURES in server/src/lib/plan.js.
const FREE = [
  'Unlimited bet logging',
  'Net profit, ROI & win rate',
  'Profit chart & day-by-day history',
  '5 AI bet scans every month',
  'Themes & a dashboard you build',
  '1 tracker',
];
const PRO = [
  'Unlimited AI bet scans',
  'Advanced analytics & breakdowns',
  'Track by sport, bookmaker & tipster',
  'Multiple trackers',
  'CSV import & export',
  'Custom share page — no badge',
];

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

      <div className="plans">
        {/* Free */}
        <div className="plan">
          <div className="plan-head">
            <span className="plan-name">Free</span>
            <div className="plan-price"><span className="pp-amt">£0</span><span className="pp-per">forever</span></div>
          </div>
          <p className="plan-tag muted">Everything you need to track your bets.</p>
          <ul className="plan-list">
            {FREE.map((f) => <li key={f}><span className="pl-check"><Icon name="check" size={13} /></span>{f}</li>)}
          </ul>
          <button className="btn-ghost plan-cta" disabled>{isPro ? 'Included' : 'Your current plan'}</button>
        </div>

        {/* Pro */}
        <div className="plan pro">
          <div className="plan-badge">Most popular</div>
          <div className="plan-head">
            <span className="plan-name">Pro</span>
            <div className="plan-price">
              {priceLabel
                ? <><span className="pp-amt">{priceLabel.split(' ')[0]}</span><span className="pp-per">{priceLabel.replace(/^\S+\s*/, '') || 'per month'}</span></>
                : <span className="pp-amt" style={{ fontSize: 26 }}>Coming soon</span>}
            </div>
          </div>
          <p className="plan-tag" style={{ color: 'var(--primary)' }}>Everything in Free, plus:</p>
          <ul className="plan-list">
            {PRO.map((f) => <li key={f}><span className="pl-check on"><Icon name="check" size={13} /></span>{f}</li>)}
          </ul>
          {isPro ? (
            <button className="btn-primary plan-cta" disabled>Current plan</button>
          ) : (
            <button className="btn-primary plan-cta" onClick={doUpgrade} disabled={busy || !ent}>
              {busy ? 'Working…' : trialDays > 0 ? `Start ${trialDays}-day free trial` : 'Upgrade to Pro'}
            </button>
          )}
          {!isPro && trialDays > 0 && priceLabel && (
            <p className="muted plan-fine">Free for {trialDays} days, then {priceLabel}. Cancel anytime.</p>
          )}
        </div>
      </div>

      <p className="muted" style={{ textAlign: 'center', fontSize: 12.5, marginTop: 18 }}>
        Cancel anytime · Please gamble responsibly · 18+
      </p>

      {showCheckout && <CheckoutModal publishableKey={billing?.publishableKey} onClose={() => setShowCheckout(false)} />}
    </div>
  );
}
