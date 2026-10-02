import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api, setToken, getToken } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useTracker } from '../context/TrackerContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { usePlan } from '../usePlan.js';
import { getCached, setCached } from '../dataCache.js';
import { saveFile } from '../download.js';
import { amountParts, currencySymbol, formatDate, formatStake, money, units } from '../format.js';
import Icon from '../components/Icon.jsx';
import CheckoutModal from '../components/CheckoutModal.jsx';
import InstallStatus from '../components/InstallStatus.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

const PRO_FEATURE_LABELS = [
  'Full stats & analytics — breakdowns, filters & streaks',
  'Unlimited AI bet scans',
  'Multiple trackers (one per tipster or strategy)',
  'CSV export & custom share page',
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
  { key: 'AUD', label: 'A$ (AUD)' },
  { key: 'CAD', label: 'C$ (CAD)' },
];
// Accent colours the user can theme their app with. All are bright enough to
// carry the near-black button text and read well on the dark UI.
const ACCENTS = [
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Lime', value: '#84cc16' },
];
const STAKE_OPTS = [
  { key: 'currency', label: 'Money' },
  { key: 'units', label: 'Units' },
  { key: 'both', label: 'Both' },
];
// Quick picks for what 1 unit is worth (in the account currency).

const ODDS_OPTS = [
  { key: 'decimal', label: 'Decimal' },
  { key: 'fractional', label: 'Fractional' },
  { key: 'american', label: 'American' },
];

// Two-letter avatar initials: prefer the capital letters in the name
// ("MilesBrown" / "Miles Brown" -> "MB"), else the first two characters.
function initialsOf(name) {
  const caps = (name || '').match(/[A-Z]/g);
  if (caps && caps.length >= 2) return caps[0] + caps[caps.length - 1];
  return (name || '?').slice(0, 2).toUpperCase();
}

// A settings card that stays closed until its header is tapped.
function SetCard({ icon, title, desc, badge, open, onToggle, children }) {
  return (
    <div className={`card set-card collapsible${open ? ' open' : ''}`}>
      <button type="button" className="set-head set-head-btn" onClick={onToggle} aria-expanded={open}>
        <span className="set-ic"><Icon name={icon} size={18} /></span>
        <div className="set-head-txt"><strong>{title}</strong><span className="muted">{desc}</span></div>
        {badge}
        <Icon name="chevron" size={16} className={`sr-chev ${open ? 'open' : ''}`} />
      </button>
      {open && <div className="set-body">{children}</div>}
    </div>
  );
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

  // ---- Units ----------------------------------------------------------------
  // The unit size is edited as text so typing feels natural ("1.", "12.5"); a
  // valid positive number is saved after a short pause, on blur, or on Enter.
  // Saving updates the shared settings straight away, so every stake and profit
  // figure in the app re-renders in the new unit size without a reload.
  const [unitText, setUnitText] = useState(() => String(staking?.unitSize ?? ''));
  const unitFocused = useRef(false);
  const unitTimer = useRef(null);
  const latest = useRef({});
  latest.current = { staking, update };
  useEffect(() => { if (!unitFocused.current) setUnitText(String(staking?.unitSize ?? '')); }, [staking?.unitSize]);
  useEffect(() => () => clearTimeout(unitTimer.current), []);
  const unitNumber = (text) => { const n = Number(text); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };
  const commitUnit = (text) => {
    const n = unitNumber(text);
    const { staking: st, update: up } = latest.current;
    if (n == null || n === Number(st?.unitSize)) return;
    const d = new Date();
    const unitFrom = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // New size applies from today; the server keeps the earlier sizes for past bets.
    up({ staking: { ...st, unitSize: n, unitFrom } });
  };
  const [confirmAll, setConfirmAll] = useState(false);
  const applyToAll = () => {
    const { staking: st, update: up } = latest.current;
    up({ staking: { ...st, unitScope: 'all' } });
    setConfirmAll(false);
  };
  const onUnitType = (text) => {
    setUnitText(text);
    clearTimeout(unitTimer.current);
    unitTimer.current = setTimeout(() => commitUnit(text), 600);
  };
  const onUnitBlur = () => {
    unitFocused.current = false;
    clearTimeout(unitTimer.current);
    if (unitNumber(unitText) != null) commitUnit(unitText);
    else setUnitText(String(latest.current.staking?.unitSize ?? '')); // invalid: put back the saved value
  };
  const unitDraft = unitNumber(unitText);
  const unitShown = unitDraft ?? (Number(staking?.unitSize) || 0);
  const toggle = (key) => setExpanded((e) => (e === key ? null : key));
  // Settings cards start closed and open when tapped. A plan message (e.g. coming
  // back from checkout) opens the Plan card so it isn't hidden.
  const [openSets, setOpenSets] = useState({});
  const toggleSet = (key) => setOpenSets((o) => ({ ...o, [key]: !o[key] }));
  const isOpen = (key) => !!openSets[key] || (key === 'plan' && !!planMsg);
  // Compact joined date so it fits the stat tile (e.g. "13 Sep 26"). Force a
  // 3-letter month — some locales render "Sept" for September, which is wide
  // enough to overflow the narrow stat column.
  const joinedShort = joined
    ? (() => {
        const jd = new Date(joined);
        const mon = jd.toLocaleDateString('en-GB', { month: 'short' }).replace('.', '').slice(0, 3);
        return `${jd.getDate()} ${mon} ${String(jd.getFullYear()).slice(2)}`;
      })()
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
    try {
      const res = await fetch('/api/auth/export', { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) return toast('Export failed. Please try again.', 'error');
      const blob = await res.blob();
      await saveFile('betbooks-export.json', blob, 'application/json');
    } catch {
      toast('Export failed. Please try again.', 'error');
    }
  }
  async function deleteAccount(e) {
    e.preventDefault();
    setDelErr(''); setBusy(true);
    try { await api.del('/auth/account', { password: delPw }); signOut(); }
    catch (err) { setDelErr(err.message); setBusy(false); }
  }

  const accent = settings?.theme?.primary || '#22c55e';
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
                <div className="ah-chips">
                  <span className={`badge ${isPro ? 'won' : ''}`} style={{ textTransform: 'none' }}>{isPro ? 'Pro' : 'Free'}</span>
                  <InstallStatus />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="ah-stats">
          <div><span className="ah-ic"><Icon name="trophy" size={16} /></span><span className="k">Total Profit</span><span className={`v ${profitCls}`}>{stats ? amountParts(stats.netProfit, currency, staking, { signed: true, units: stats.netProfitU }).main : '—'}</span></div>
          <div><span className="ah-ic"><Icon name="target" size={16} /></span><span className="k">Win Rate</span><span className="v">{stats ? `${stats.winRate}%` : '—'}</span></div>
          <div><span className="ah-ic"><Icon name="coins" size={16} /></span><span className="k">Total Bets</span><span className="v">{stats ? stats.totalBets : '—'}</span></div>
          <div><span className="ah-ic"><Icon name="calendar" size={16} /></span><span className="k">Joined</span><span className="v sm">{joinedShort}</span></div>
        </div>
      </div>

      {/* Account settings */}
      <SetCard icon="account" title="Account settings" desc="Update your personal details and preferences." open={isOpen('account')} onToggle={() => toggleSet('account')}>

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
      </SetCard>

      {/* Display preferences */}
      <SetCard icon="monitor" title="Display preferences" desc="Choose what you want to see in your app." open={isOpen('display')} onToggle={() => toggleSet('display')}>

        <div className="set-subhead">Appearance<span className="muted">Light or dark theme</span></div>
        <div className="seg-group" style={{ marginBottom: 6, maxWidth: 260 }}>
          {[{ k: 'dark', label: 'Dark' }, { k: 'light', label: 'Light' }].map((o) => (
            <button key={o.k} type="button" className={`seg ${(settings?.theme?.mode || 'dark') === o.k ? 'on' : ''}`}
              onClick={() => update({ theme: { ...settings.theme, mode: o.k } })}>{o.label}</button>
          ))}
        </div>

        <div className="set-subhead" style={{ marginTop: 14 }}>Accent colour<span className="muted">Personalise the highlight colour across your app</span></div>
        <div className="swatch-row">
          {ACCENTS.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`swatch ${accent.toLowerCase() === c.value.toLowerCase() ? 'on' : ''}`}
              style={{ background: c.value }}
              onClick={() => update({ theme: { ...settings.theme, primary: c.value } })}
              aria-label={c.name}
              title={c.name}
            >
              {accent.toLowerCase() === c.value.toLowerCase() && <Icon name="check" size={16} />}
            </button>
          ))}
        </div>
      </SetCard>

      {/* Units */}
      <SetCard icon="coins" title="Units" desc="Choose what 1 unit is worth and how amounts are shown." open={isOpen('units')} onToggle={() => toggleSet('units')}>

        <div className="set-subhead">Show stakes &amp; profit as<span className="muted">Applies everywhere in the app</span></div>
        <div className="seg-group" style={{ marginBottom: 6 }}>
          {STAKE_OPTS.map((o) => (
            <button key={o.key} type="button" className={`seg ${(staking?.mode || 'currency') === o.key ? 'on' : ''}`}
              onClick={() => update({ staking: { ...staking, mode: o.key } })}>{o.label}</button>
          ))}
        </div>

        <div className="set-subhead" style={{ marginTop: 14 }}>1 unit equals<span className="muted">Used to turn money into units</span></div>
        <div className="input-prefix" style={{ maxWidth: 170 }}>
          <span className="input-prefix-sym">{currencySymbol(currency)}</span>
          <input
            id="unit-size" type="number" inputMode="decimal" min="0.01" step="0.01"
            value={unitText} aria-label="1 unit equals" aria-invalid={unitText !== '' && unitDraft == null}
            onFocus={() => { unitFocused.current = true; }}
            onChange={(e) => onUnitType(e.target.value)}
            onBlur={onUnitBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
        </div>
        {unitText !== '' && unitDraft == null && (
          <div className="muted" style={{ fontSize: 12.5, marginTop: 6, color: 'var(--loss)' }}>Enter an amount above zero.</div>
        )}

        <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 0' }}>
          {unitShown > 0
            ? <>Example: a {money(25, currency)} stake is <strong style={{ color: 'var(--text)' }}>{units(25 / unitShown)}</strong>, and {money(60, currency, { signed: true })} profit is <strong style={{ color: 'var(--text)' }}>{units(60 / unitShown, { signed: true })}</strong>.</>
            : 'Set an amount above to see units.'}
        </p>
        <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
          Changing this updates your figures straight away. The new size applies to bets from today on, and your past bets keep the unit size they were placed under, so your record doesn't change.
        </p>
        {(staking?.unitHistory?.length ?? 0) > 1 && (
          <div className="unit-hist" style={{ marginTop: 14 }}>
            <div className="set-subhead" style={{ marginTop: 0 }}>Your unit sizes<span className="muted">Each bet uses the size from the day it was placed</span></div>
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 6, fontSize: 13.5 }}>
              {staking.unitHistory.map((e, i, all) => (
                <li key={(e.from || 'start') + e.size} className="row spread">
                  <strong>1u = {money(e.size, currency)}</strong>
                  <span className="muted">
                    {i === 0 ? `up to ${formatDate(all[1].from)}` : i === all.length - 1 ? `from ${formatDate(e.from)}` : `${formatDate(e.from)} – ${formatDate(all[i + 1].from)}`}
                  </span>
                </li>
              ))}
            </ul>
            {!confirmAll ? (
              <button type="button" className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setConfirmAll(true)}>
                Use {money(staking.unitSize, currency)} for all past bets too
              </button>
            ) : (
              <div className="card" style={{ marginTop: 12, padding: 12 }}>
                <p style={{ margin: '0 0 10px', fontSize: 13.5 }}>
                  This re-expresses every past bet at 1u = {money(staking.unitSize, currency)}. Your pounds don't change, but past unit figures will. Continue?
                </p>
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn-primary" onClick={applyToAll}>Yes, change all</button>
                  <button type="button" className="btn-ghost" onClick={() => setConfirmAll(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </SetCard>

      {/* App preferences */}
      <SetCard icon="gear" title="App preferences" desc="Fine tune your experience." open={isOpen('app')} onToggle={() => toggleSet('app')}>

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
        <div className="pref-row">
          <span className="sr-ic"><Icon name="target" size={17} /></span>
          <span className="pref-label">Odds format</span>
          <select className="pref-select" value={settings?.oddsFormat || 'decimal'} onChange={(e) => update({ oddsFormat: e.target.value })}>
            {ODDS_OPTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <button type="button" className="set-row" onClick={() => navigate('/customise')}>
          <span className="sr-ic"><Icon name="sliders" size={17} /></span>
          <div className="sr-txt"><strong>More customisation</strong><span className="muted">Dashboard cards, staking unit & sharing</span></div>
          <Icon name="chevron" size={16} className="sr-chev" style={{ transform: 'rotate(-90deg)' }} />
        </button>
      </SetCard>

      {/* Plan & billing — kept a clear, standard route so cancelling stays
          easy to find (as the law and Stripe require), just not the most
          prominent thing on the page. */}
      <SetCard icon="trophy" title="Plan &amp; billing" desc={isPro ? 'Manage or cancel your subscription.' : 'Upgrade to unlock everything.'} badge={<span className={`badge ${isPro ? 'won' : ''}`} style={{ textTransform: 'none' }}>{isPro ? 'Pro' : 'Free'}</span>} open={isOpen('plan')} onToggle={() => toggleSet('plan')}>
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
              <button className="btn-ghost btn-sm" onClick={openPortal} disabled={planBusy}>{planBusy ? 'Working…' : 'Manage or cancel'}</button>
            ) : (
              <button className="btn-ghost btn-sm" onClick={() => setPlanDev('free')} disabled={planBusy}>Switch back to Free</button>
            )}
          </div>
        )}
      </SetCard>

      {/* Data & security */}
      <SetCard icon="lock" title="Data &amp; security" desc="Your data and where you’re signed in." open={isOpen('data')} onToggle={() => toggleSet('data')}>
        <div className="tog-row"><span className="sr-ic"><Icon name="log" size={17} /></span>
          <div className="sr-txt"><strong>Export my data</strong><span className="muted">All your bets and settings as JSON</span></div>
          <button className="btn-ghost btn-sm" onClick={exportData}>Export</button>
        </div>
        <div className="tog-row"><span className="sr-ic"><Icon name="logout" size={17} /></span>
          <div className="sr-txt"><strong>Log out everywhere</strong><span className="muted">Sign out of all devices</span></div>
          <button className="btn-ghost btn-sm" onClick={logoutEverywhere}>Log out all</button>
        </div>
      </SetCard>

      {/* Responsible gambling */}
      <SetCard icon="target" title="Responsible gambling" desc="Betting should be fun and within your means." open={isOpen('rg')} onToggle={() => toggleSet('rg')}>
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
      </SetCard>

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
