import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api, setToken, getToken } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useTracker } from '../context/TrackerContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { usePlan } from '../usePlan.js';
import { getCached, setCached } from '../dataCache.js';
import { formatDate, formatStake } from '../format.js';
import Icon from '../components/Icon.jsx';
import CheckoutModal from '../components/CheckoutModal.jsx';
import InstallAppCard from '../components/InstallAppCard.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

const PRO_FEATURE_LABELS = [
  'Multiple trackers (one per tipster or strategy)',
  'Advanced analytics (date ranges, filters, bankroll growth)',
  'Custom share page (no badge)',
];

const RANGE_OPTS = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'ytd', label: 'This year' },
  { key: 'all', label: 'All time' },
];
const CURRENCY_OPTS = [
  { key: 'GBP', label: 'GBP (£)' },
  { key: 'USD', label: 'USD ($)' },
  { key: 'EUR', label: 'EUR (€)' },
  { key: 'AUD', label: 'AUD (A$)' },
  { key: 'CAD', label: 'CAD (C$)' },
];

// Two-letter avatar initials: prefer the capital letters in the name
// ("MilesBrown" / "Miles Brown" -> "MB"), else the first two characters.
function initialsOf(name) {
  const caps = (name || '').match(/[A-Z]/g);
  if (caps && caps.length >= 2) return caps[0] + caps[caps.length - 1];
  return (name || '?').slice(0, 2).toUpperCase();
}

export default function Account() {
  const { user, logout, refreshUser } = useAuth();
  const { settings, update } = useSettings();
  const { activeId } = useTracker();
  const { ent, refresh: refreshPlan } = usePlan();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const signOut = () => { logout(); navigate('/'); };

  const [info, setInfo] = useState(() => getCached('accountInfo') ?? null);
  const [stats, setStats] = useState(() => getCached('accountStats:' + activeId)?.stats ?? null);
  const [planMsg, setPlanMsg] = useState('');
  const [planBusy, setPlanBusy] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [expanded, setExpanded] = useState(null); // which settings row is open
  const billing = ent?.billing;
  const isPro = ent ? !!ent.pro : user?.plan === 'pro';
  const email = user?.email || info?.email || '';
  const username = user?.username || info?.username || '';
  const joined = user?.created_at || info?.created_at;

  const currency = settings?.currency || 'GBP';
  const staking = settings?.staking;
  const toggle = (key) => setExpanded((e) => (e === key ? null : key));
  // Compact joined date so it fits the stat tile (e.g. "13 Sep 26").
  const joinedShort = joined
    ? new Date(joined).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
    : '—';

  // Returning from Stripe Checkout (?upgrade=success|cancelled).
  useEffect(() => {
    const u = params.get('upgrade');
    if (!u) return;
    if (u === 'success') { setPlanMsg('Welcome to Pro — thanks for subscribing! It can take a few seconds to activate.'); refreshPlan(); }
    else if (u === 'cancelled') setPlanMsg('Checkout cancelled — no charge was made.');
    params.delete('upgrade');
    setParams(params, { replace: true });
  }, [params, setParams, refreshPlan]);

  useEffect(() => {
    api.get('/auth/me').then((d) => { setInfo(d.user); setCached('accountInfo', d.user); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!activeId) return;
    api.get('/bets/stats?tracker=' + activeId).then((d) => {
      setStats(d.stats); setCached('accountStats:' + activeId, { stats: d.stats });
    }).catch(() => {});
  }, [activeId]);

  // ---- Plan / billing ------------------------------------------------------
  async function setPlanDev(plan) {
    setPlanBusy(true); setPlanMsg('');
    try { await api.post('/plan/dev-set', { plan }); await refreshPlan(); }
    catch (err) { setPlanMsg(err.status === 403 ? 'Paid plans are coming soon — checkout isn’t wired up yet.' : err.message); }
    finally { setPlanBusy(false); }
  }
  function startCheckout() { setPlanMsg(''); setShowCheckout(true); }
  async function openPortal() {
    setPlanBusy(true); setPlanMsg('');
    // Open Stripe in a SEPARATE browser view rather than navigating the app's
    // own view (that leaves iOS with a mis-sized view on return). Pre-open
    // synchronously so it isn't treated as a blocked popup.
    const win = window.open('', '_blank');
    try {
      const d = await api.post('/billing/portal');
      if (win) win.location.href = d.url;
      else { try { localStorage.setItem('bt_stripe_return', String(Date.now())); } catch {} window.location.href = d.url; }
    } catch (err) {
      try { win?.close(); } catch {}
      setPlanMsg(err.message || 'Could not open the billing portal.');
    } finally { setPlanBusy(false); }
  }
  const doUpgrade = () => (billing?.enabled ? startCheckout() : setPlanDev('pro'));

  // ---- Edit display name ---------------------------------------------------
  const [nameEdit, setNameEdit] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  function openNameEdit() { setNameVal(username); setNameEdit(true); }
  async function saveName(e) {
    e?.preventDefault();
    const name = nameVal.trim();
    if (!name || name === username) { setNameEdit(false); return; }
    setNameBusy(true);
    try {
      await api.post('/auth/profile', { username: name });
      await refreshUser();
      setInfo((i) => (i ? { ...i, username: name } : i));
      setNameEdit(false);
      toast('Name updated', 'success');
    } catch (err) { toast(err.message || 'Could not update your name', 'error'); }
    finally { setNameBusy(false); }
  }

  // ---- Change password -----------------------------------------------------
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);
  async function changePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (pw.next !== pw.confirm) return setPwMsg({ type: 'err', text: 'New passwords do not match' });
    setPwBusy(true);
    try {
      const d = await api.post('/auth/change-password', { currentPassword: pw.current, newPassword: pw.next });
      setToken(d.token);
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg({ type: 'ok', text: 'Password updated. Other devices have been signed out.' });
    } catch (err) { setPwMsg({ type: 'err', text: err.message }); }
    finally { setPwBusy(false); }
  }

  // ---- Data & danger zone --------------------------------------------------
  const [confirming, setConfirming] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delErr, setDelErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function logoutEverywhere() {
    if (!confirm('Sign out of every device, including this one?')) return;
    try { await api.post('/auth/logout-all'); } catch {}
    signOut();
  }
  async function exportData() {
    const res = await fetch('/api/auth/export', { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) return alert('Export failed. Please try again.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'betbooks-export.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  async function deleteAccount(e) {
    e.preventDefault();
    setDelErr(''); setBusy(true);
    try { await api.del('/auth/account', { password: delPw }); signOut(); }
    catch (err) { setDelErr(err.message); setBusy(false); }
  }

  const nav = settings?.nav || {};
  const setNav = (key, val) => update({ nav: { ...nav, [key]: val } });
  const profitCls = stats && stats.netProfit > 0 ? 'pos' : stats && stats.netProfit < 0 ? 'neg' : '';

  return (
    <div className="main">
      {/* Profile hero */}
      <div className="card acct-hero">
        <div className="ah-top">
          <div className="ah-avatar" role="img" aria-label="Avatar">
            {initialsOf(username)}
            <button type="button" className="ah-avatar-edit" onClick={openNameEdit} aria-label="Edit name"><Icon name="edit" size={13} /></button>
          </div>
          <div className="ah-id">
            {nameEdit ? (
              <form className="ah-name-edit" onSubmit={saveName}>
                <input value={nameVal} onChange={(e) => setNameVal(e.target.value)} maxLength={40} autoFocus aria-label="Display name" />
                <button type="submit" className="btn-primary btn-sm" disabled={nameBusy}>{nameBusy ? '…' : 'Save'}</button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setNameEdit(false)}>Cancel</button>
              </form>
            ) : (
              <>
                <div className="ah-name">{username}</div>
                <div className="ah-email">{email}</div>
                <span className={`badge ${isPro ? 'won' : ''}`} style={{ textTransform: 'none' }}>{isPro ? 'Pro' : 'Free'}</span>
              </>
            )}
          </div>
        </div>

        <div className="ah-stats">
          <div><span className="ah-ic"><Icon name="trophy" size={16} /></span><span className="k">Total Profit</span><span className={`v ${profitCls}`}>{stats ? formatStake(stats.netProfit, currency, staking, { signed: true }) : '—'}</span></div>
          <div><span className="ah-ic"><Icon name="target" size={16} /></span><span className="k">Win Rate</span><span className="v">{stats ? `${stats.winRate}%` : '—'}</span></div>
          <div><span className="ah-ic"><Icon name="coins" size={16} /></span><span className="k">Total Bets</span><span className="v">{stats ? stats.totalBets : '—'}</span></div>
          <div><span className="ah-ic"><Icon name="calendar" size={16} /></span><span className="k">Joined</span><span className="v sm">{joinedShort}</span></div>
        </div>
      </div>

      {/* Plan */}
      <div className="card set-card">
        <div className="set-head">
          <span className="set-ic"><Icon name="trophy" size={18} /></span>
          <div className="set-head-txt"><strong>Plan</strong><span className="muted">{isPro ? 'You’re on Pro — thanks for supporting Betbooks.' : 'Upgrade to unlock everything.'}</span></div>
          <span className={`badge ${isPro ? 'won' : ''}`} style={{ textTransform: 'none' }}>{isPro ? 'Pro' : 'Free'}</span>
        </div>
        {planMsg && <div className="muted" style={{ fontSize: 13, margin: '4px 2px 8px' }}>{planMsg}</div>}
        {!isPro ? (
          <div style={{ padding: '4px 2px 2px' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {billing?.trialDays > 0
                ? <>Try Pro free for {billing.trialDays} days{billing?.priceLabel ? <span className="muted" style={{ fontWeight: 500 }}> · then {billing.priceLabel}</span> : ''}</>
                : <>Upgrade to Pro{billing?.priceLabel ? <span className="muted" style={{ fontWeight: 500 }}> · {billing.priceLabel}</span> : ''}</>}
            </div>
            <ul className="muted" style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
              {PRO_FEATURE_LABELS.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <button className="btn-primary" onClick={doUpgrade} disabled={planBusy || !ent}>
              {planBusy ? 'Working…' : billing?.trialDays > 0 ? `Start ${billing.trialDays}-day free trial` : 'Upgrade to Pro'}
            </button>
          </div>
        ) : (
          <div style={{ padding: '2px 2px' }}>
            {billing?.enabled ? (
              <button className="btn-ghost btn-sm" onClick={openPortal} disabled={planBusy}>{planBusy ? 'Working…' : 'Manage billing'}</button>
            ) : (
              <button className="btn-ghost btn-sm" onClick={() => setPlanDev('free')} disabled={planBusy}>Switch back to Free</button>
            )}
          </div>
        )}
      </div>

      {/* Account settings */}
      <div className="card set-card">
        <div className="set-head">
          <span className="set-ic"><Icon name="account" size={18} /></span>
          <div className="set-head-txt"><strong>Account settings</strong><span className="muted">Update your personal details and preferences.</span></div>
        </div>

        <button type="button" className="set-row" onClick={() => toggle('personal')}>
          <span className="sr-ic"><Icon name="account" size={17} /></span>
          <div className="sr-txt"><strong>Personal information</strong><span className="muted">Name and email</span></div>
          <Icon name="chevron" size={16} className={`sr-chev ${expanded === 'personal' ? 'open' : ''}`} />
        </button>
        {expanded === 'personal' && (
          <div className="set-panel">
            <div className="row spread"><span className="muted">Name</span><span className="row" style={{ gap: 8 }}><strong>{username}</strong><button type="button" className="linklike" onClick={openNameEdit}>Edit</button></span></div>
            <div className="row spread" style={{ marginTop: 8 }}><span className="muted">Email</span><strong>{email}</strong></div>
            {joined && <div className="row spread" style={{ marginTop: 8 }}><span className="muted">Member since</span><strong>{formatDate(joined)}</strong></div>}
          </div>
        )}

        <button type="button" className="set-row" onClick={() => toggle('password')}>
          <span className="sr-ic"><Icon name="lock" size={17} /></span>
          <div className="sr-txt"><strong>Change password</strong><span className="muted">Keep your account secure</span></div>
          <Icon name="chevron" size={16} className={`sr-chev ${expanded === 'password' ? 'open' : ''}`} />
        </button>
        {expanded === 'password' && (
          <div className="set-panel">
            {pwMsg && <div className={pwMsg.type === 'ok' ? 'success-banner' : 'error-banner'}>{pwMsg.text}</div>}
            <form onSubmit={changePassword}>
              <div className="field">
                <label>Current password</label>
                <PasswordInput value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" ariaLabel="Current password" required />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>New password</label>
                  <PasswordInput value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="At least 8 characters" autoComplete="new-password" ariaLabel="New password" required />
                </div>
                <div className="field">
                  <label>Confirm new password</label>
                  <PasswordInput value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" ariaLabel="Confirm new password" required />
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={pwBusy}>{pwBusy ? 'Updating…' : 'Update password'}</button>
            </form>
          </div>
        )}
      </div>

      {/* Display preferences */}
      <div className="card set-card">
        <div className="set-head">
          <span className="set-ic"><Icon name="monitor" size={18} /></span>
          <div className="set-head-txt"><strong>Display preferences</strong><span className="muted">Choose what you want to see in your app.</span></div>
        </div>

        <div className="set-subhead">Show / hide tabs<span className="muted">Customise your bottom navigation</span></div>
        {[{ key: 'home', label: 'Home', icon: 'house' }, { key: 'bets', label: 'Bets', icon: 'bets' }, { key: 'stats', label: 'Stats', icon: 'analytics' }].map((t) => (
          <div className="tog-row" key={t.key}>
            <span className="sr-ic"><Icon name={t.icon} size={17} /></span>
            <span className="tog-label">{t.label}</span>
            <label className="switch">
              <input type="checkbox" checked={nav[t.key] !== false} onChange={(e) => setNav(t.key, e.target.checked)} />
              <span className="slider" />
            </label>
          </div>
        ))}
        <div className="tog-row">
          <span className="sr-ic"><Icon name="account" size={17} /></span>
          <span className="tog-label">You <span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>· always on</span></span>
          <label className="switch"><input type="checkbox" checked readOnly disabled /><span className="slider" /></label>
        </div>

        <div className="tog-row" style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 14 }}>
          <span className="sr-ic"><Icon name="eye-off" size={17} /></span>
          <span className="tog-label">Hide advanced stats<span className="muted" style={{ display: 'block', fontWeight: 500, fontSize: 12 }}>Keep the Stats page simple</span></span>
          <label className="switch">
            <input type="checkbox" checked={!!settings?.simpleStats} onChange={(e) => update({ simpleStats: e.target.checked })} />
            <span className="slider" />
          </label>
        </div>
      </div>

      {/* App preferences */}
      <div className="card set-card">
        <div className="set-head">
          <span className="set-ic"><Icon name="gear" size={18} /></span>
          <div className="set-head-txt"><strong>App preferences</strong><span className="muted">Fine tune your experience.</span></div>
        </div>

        <div className="pref-row">
          <span className="sr-ic"><Icon name="calendar" size={17} /></span>
          <span className="pref-label">Default time range</span>
          <select className="pref-select" value={settings?.defaultRange || 'all'} onChange={(e) => update({ defaultRange: e.target.value })}>
            {RANGE_OPTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
        <div className="pref-row">
          <span className="sr-ic"><Icon name="coins" size={17} /></span>
          <span className="pref-label">Currency</span>
          <select className="pref-select" value={currency} onChange={(e) => update({ currency: e.target.value })}>
            {CURRENCY_OPTS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <button type="button" className="set-row" onClick={() => navigate('/customise')}>
          <span className="sr-ic"><Icon name="sliders" size={17} /></span>
          <div className="sr-txt"><strong>More customisation</strong><span className="muted">Themes, dashboard, odds format, staking & sharing</span></div>
          <Icon name="chevron" size={16} className="sr-chev" style={{ transform: 'rotate(-90deg)' }} />
        </button>
      </div>

      <InstallAppCard isPro={isPro} onUpgrade={doUpgrade} />

      {/* Data & security */}
      <div className="card set-card">
        <div className="set-head">
          <span className="set-ic"><Icon name="lock" size={18} /></span>
          <div className="set-head-txt"><strong>Data & security</strong><span className="muted">Your data and where you’re signed in.</span></div>
        </div>
        <div className="tog-row"><span className="sr-ic"><Icon name="log" size={17} /></span>
          <div className="sr-txt"><strong>Export my data</strong><span className="muted">All your bets and settings as JSON</span></div>
          <button className="btn-ghost btn-sm" onClick={exportData}>Export</button>
        </div>
        <div className="tog-row"><span className="sr-ic"><Icon name="logout" size={17} /></span>
          <div className="sr-txt"><strong>Log out everywhere</strong><span className="muted">Sign out of all devices</span></div>
          <button className="btn-ghost btn-sm" onClick={logoutEverywhere}>Log out all</button>
        </div>
      </div>

      {/* Responsible gambling */}
      <div className="card set-card">
        <div className="set-head">
          <span className="set-ic"><Icon name="target" size={18} /></span>
          <div className="set-head-txt"><strong>Responsible gambling</strong><span className="muted">Betting should be fun and within your means.</span></div>
        </div>
        <div className="stack" style={{ gap: 8, marginTop: 4 }}>
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

      {/* Log out */}
      <button type="button" className="card logout-row" onClick={signOut}>
        <span className="sr-ic"><Icon name="logout" size={18} /></span>
        <span className="logout-txt">Log out</span>
        <Icon name="chevron" size={16} style={{ transform: 'rotate(-90deg)', color: 'var(--muted)' }} />
      </button>

      {/* Danger zone */}
      <div className="card" style={{ borderColor: 'var(--loss)', marginTop: 16 }}>
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
              <PasswordInput value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder="Your password" autoComplete="current-password" ariaLabel="Password" required />
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

      {showCheckout && <CheckoutModal publishableKey={billing?.publishableKey} onClose={() => setShowCheckout(false)} />}
    </div>
  );
}
