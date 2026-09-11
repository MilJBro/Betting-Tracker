import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api, setToken, getToken } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { usePlan } from '../usePlan.js';
import { formatDate } from '../format.js';

const PRO_FEATURE_LABELS = [
  'Multiple trackers (one per tipster or strategy)',
  'Advanced analytics (date ranges, filters, bankroll growth)',
  'CSV import & export',
  'Custom share page (no badge)',
];

const PROFILE_LABELS = {
  trackingStyle: { title: 'Betting style', map: { own: 'Tracks own bets', tipster: 'Follows tipsters', both: 'Own bets & tipsters' } },
  frequency: { title: 'Frequency', map: { daily: 'Most days', weekly: 'A few times a week', occasional: 'Now and then' } },
  goal: { title: 'Main goal', map: { profit: 'Long-term profit', discipline: 'Staying disciplined', analyse: 'Understanding performance', fun: 'Tracking for fun' } },
  experience: { title: 'Experience', map: { new: 'New to betting', casual: 'Casual bettor', experienced: 'Experienced', serious: 'Serious / semi-pro' } },
};

export default function Account() {
  const { user, logout } = useAuth();
  const { settings, save } = useSettings();
  const { ent, refresh: refreshPlan } = usePlan();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const signOut = () => { logout(); navigate('/'); };
  const [info, setInfo] = useState(null);
  const [planMsg, setPlanMsg] = useState('');
  const [planBusy, setPlanBusy] = useState(false);
  const billing = ent?.billing;

  // Returning from Stripe Checkout (?upgrade=success|cancelled).
  useEffect(() => {
    const u = params.get('upgrade');
    if (!u) return;
    if (u === 'success') { setPlanMsg('Welcome to Pro — thanks for subscribing! It can take a few seconds to activate.'); refreshPlan(); }
    else if (u === 'cancelled') setPlanMsg('Checkout cancelled — no charge was made.');
    params.delete('upgrade');
    setParams(params, { replace: true });
  }, [params, setParams, refreshPlan]);

  async function setPlanDev(plan) {
    setPlanBusy(true); setPlanMsg('');
    try {
      await api.post('/plan/dev-set', { plan });
      await refreshPlan();
    } catch (err) {
      setPlanMsg(err.status === 403 ? 'Paid plans are coming soon — checkout isn’t wired up yet.' : err.message);
    } finally {
      setPlanBusy(false);
    }
  }

  // Real Stripe checkout (production) — redirect the browser to Stripe.
  async function startCheckout() {
    setPlanBusy(true); setPlanMsg('');
    try {
      const d = await api.post('/billing/checkout');
      window.location.href = d.url;
    } catch (err) {
      setPlanMsg(err.message || 'Could not start checkout.');
      setPlanBusy(false);
    }
  }
  async function openPortal() {
    setPlanBusy(true); setPlanMsg('');
    try {
      const d = await api.post('/billing/portal');
      window.location.href = d.url;
    } catch (err) {
      setPlanMsg(err.message || 'Could not open the billing portal.');
      setPlanBusy(false);
    }
  }
  // Upgrade uses Stripe when configured, otherwise the dev toggle (local only).
  const doUpgrade = () => (billing?.enabled ? startCheckout() : setPlanDev('pro'));

  const profile = settings?.profile;
  async function retakeQuestionnaire() {
    if (!settings) return;
    await save({ ...settings, profile: { ...settings.profile, onboarded: false } });
  }

  // Change password
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState(null); // {type, text}
  const [pwBusy, setPwBusy] = useState(false);

  // Delete account
  const [confirming, setConfirming] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delErr, setDelErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then((d) => setInfo(d.user)).catch(() => {});
  }, []);

  async function changePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (pw.next !== pw.confirm) return setPwMsg({ type: 'err', text: 'New passwords do not match' });
    setPwBusy(true);
    try {
      const d = await api.post('/auth/change-password', {
        currentPassword: pw.current,
        newPassword: pw.next,
      });
      setToken(d.token); // adopt the freshly rotated token
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg({ type: 'ok', text: 'Password updated. Other devices have been signed out.' });
    } catch (err) {
      setPwMsg({ type: 'err', text: err.message });
    } finally {
      setPwBusy(false);
    }
  }

  async function logoutEverywhere() {
    if (!confirm('Sign out of every device, including this one?')) return;
    try {
      await api.post('/auth/logout-all');
    } catch {}
    signOut();
  }

  async function exportData() {
    const res = await fetch('/api/auth/export', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return alert('Export failed. Please try again.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'betbooks-export.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount(e) {
    e.preventDefault();
    setDelErr('');
    setBusy(true);
    try {
      await api.del('/auth/account', { password: delPw });
      signOut();
    } catch (err) {
      setDelErr(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h1>Account</h1>
          <p>Manage your login and your data.</p>
        </div>
        <button className="btn-ghost" onClick={signOut}>↪ Log out</button>
      </div>

      <button
        type="button"
        onClick={() => navigate('/customise')}
        className="card"
        style={{
          display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center',
          justifyContent: 'space-between', gap: 12, marginBottom: 18, cursor: 'pointer',
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}
      >
        <span>
          <strong style={{ display: 'block' }}>Style &amp; customisation</strong>
          <span className="muted" style={{ fontSize: 13 }}>Theme, dashboard stats, currency, odds format and sharing.</span>
        </span>
        <span className="muted" style={{ fontSize: 20 }}>→</span>
      </button>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">Profile</h3>
        <div className="stack" style={{ gap: 8 }}>
          <div className="row spread"><span className="muted">Username</span><strong>{info?.username || user?.username}</strong></div>
          <div className="row spread"><span className="muted">Email</span><strong>{info?.email || user?.email}</strong></div>
          {info?.created_at && (
            <div className="row spread"><span className="muted">Member since</span><strong>{formatDate(info.created_at)}</strong></div>
          )}
        </div>
      </div>

      {/* Plan & billing */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row spread" style={{ marginBottom: 4 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Plan</h3>
          <span className={`badge ${ent?.pro ? 'won' : ''}`} style={{ textTransform: 'none' }}>{ent?.pro ? 'Pro' : 'Free'}</span>
        </div>
        {planMsg && <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{planMsg}</div>}
        {ent && !ent.pro && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Upgrade to Pro{billing?.priceLabel ? <span className="muted" style={{ fontWeight: 500 }}> · {billing.priceLabel}</span> : ''}
            </div>
            <ul className="muted" style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
              {PRO_FEATURE_LABELS.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <button className="btn-primary" onClick={doUpgrade} disabled={planBusy}>{planBusy ? 'Working…' : 'Upgrade to Pro'}</button>
          </div>
        )}
        {ent && ent.pro && (
          <>
            <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>You have all Pro features. Thanks for supporting Betbooks.</p>
            {billing?.enabled ? (
              <button className="btn-ghost btn-sm" onClick={openPortal} disabled={planBusy}>{planBusy ? 'Working…' : 'Manage billing'}</button>
            ) : (
              <button className="btn-ghost btn-sm" onClick={() => setPlanDev('free')} disabled={planBusy}>Switch back to Free</button>
            )}
          </>
        )}
      </div>

      {profile && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="row spread" style={{ marginBottom: 4 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Bettor profile</h3>
            <button className="btn-ghost btn-sm" onClick={retakeQuestionnaire}>Retake questionnaire</button>
          </div>
          <div className="stack" style={{ gap: 8, marginTop: 12 }}>
            {Object.keys(PROFILE_LABELS).map((k) => {
              // Answers may be a single value or (for multi-select questions) an array.
              const raw = profile[k];
              const vals = Array.isArray(raw) ? raw : raw ? [raw] : [];
              const text = vals.map((v) => PROFILE_LABELS[k].map[v] || v).join(', ');
              return (
                <div className="row spread" key={k} style={{ alignItems: 'flex-start' }}>
                  <span className="muted">{PROFILE_LABELS[k].title}</span>
                  <strong style={{ textAlign: 'right', maxWidth: '65%' }}>{text || '—'}</strong>
                </div>
              );
            })}
            {profile.sports?.length > 0 && (
              <div className="row spread" style={{ alignItems: 'flex-start' }}>
                <span className="muted">Sports</span>
                <strong style={{ textAlign: 'right', maxWidth: '65%' }}>{profile.sports.join(', ')}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">Change password</h3>
        {pwMsg && <div className={pwMsg.type === 'ok' ? 'success-banner' : 'error-banner'}>{pwMsg.text}</div>}
        <form onSubmit={changePassword}>
          <div className="field">
            <label>Current password</label>
            <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>New password</label>
              <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="At least 8 characters" required />
            </div>
            <div className="field">
              <label>Confirm new password</label>
              <input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={pwBusy}>{pwBusy ? 'Updating…' : 'Update password'}</button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">Sessions & data</h3>
        <div className="stack">
          <div className="row spread" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Export my data</div>
              <div className="muted" style={{ fontSize: 13 }}>Download all your bets and settings as JSON.</div>
            </div>
            <button className="btn-ghost" onClick={exportData}>Export</button>
          </div>
          <div className="row spread" style={{ flexWrap: 'wrap', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Log out everywhere</div>
              <div className="muted" style={{ fontSize: 13 }}>Sign out of all devices, including this one.</div>
            </div>
            <button className="btn-ghost" onClick={logoutEverywhere}>Log out all</button>
          </div>
        </div>
      </div>

      {/* Responsible gambling */}
      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">Responsible gambling</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Betbooks is a tracker, not a bookmaker. Betting should be fun and within your means —
          if it stops feeling that way, free, confidential help is available.
        </p>
        <div className="stack" style={{ gap: 8 }}>
          <a className="row spread" href="https://www.begambleaware.org/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span style={{ fontWeight: 600 }}>BeGambleAware</span><span className="muted" style={{ fontSize: 13 }}>Advice & support →</span>
          </a>
          <a className="row spread" href="https://www.gamcare.org.uk/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <span style={{ fontWeight: 600 }}>GamCare</span><span className="muted" style={{ fontSize: 13 }}>Live chat & forum →</span>
          </a>
          <a className="row spread" href="https://www.gamstop.co.uk/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <span style={{ fontWeight: 600 }}>GAMSTOP</span><span className="muted" style={{ fontSize: 13 }}>Self-exclude from betting sites →</span>
          </a>
          <a className="row spread" href="tel:08088020133" style={{ textDecoration: 'none', color: 'inherit', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <span style={{ fontWeight: 600 }}>National Gambling Helpline</span><span className="muted" style={{ fontSize: 13 }}>0808 8020 133 →</span>
          </a>
        </div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 0, marginTop: 12 }}>You must be 18+ to gamble. When the fun stops, stop.</p>
      </div>

      <div className="card" style={{ borderColor: 'var(--loss)' }}>
        <h3 className="section-title" style={{ color: 'var(--loss)' }}>Danger zone</h3>
        {!confirming ? (
          <div className="row spread" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Delete account</div>
              <div className="muted" style={{ fontSize: 13 }}>Permanently removes your account and all bets. This cannot be undone.</div>
            </div>
            <button className="btn-danger" onClick={() => setConfirming(true)}>Delete account</button>
          </div>
        ) : (
          <form onSubmit={deleteAccount}>
            <p style={{ marginTop: 0 }}>Enter your password to confirm permanent deletion.</p>
            {delErr && <div className="error-banner">{delErr}</div>}
            <div className="field">
              <input type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder="Your password" required />
            </div>
            <div className="row">
              <button type="button" className="btn-ghost" onClick={() => { setConfirming(false); setDelPw(''); setDelErr(''); }}>Cancel</button>
              <button type="submit" className="btn-danger" disabled={busy}>{busy ? 'Deleting…' : 'Permanently delete'}</button>
            </div>
          </form>
        )}
      </div>

      <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 20 }}>
        <Link to="/terms" style={{ color: 'inherit' }}>Terms</Link> ·{' '}
        <Link to="/privacy" style={{ color: 'inherit' }}>Privacy</Link>
      </p>
    </div>
  );
}
