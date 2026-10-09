import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { getCached, setCached } from '../dataCache.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useTracker } from '../context/TrackerContext.jsx';
import { usePlan } from '../usePlan.js';
import { amountParts } from '../format.js';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import InstallStatus from './InstallStatus.jsx';

// 'MilesBrown' / 'Miles Brown' -> 'MB', otherwise the first two letters.
function initialsOf(name) {
  const caps = (name || '').match(/[A-Z]/g);
  if (caps && caps.length >= 2) return caps[0] + caps[caps.length - 1];
  return (name || '?').slice(0, 2).toUpperCase();
}

// The mobile side menu (the main view; tracker edit/create sheets live in
// TrackerBar). `onClose` dismisses it; `onNewTracker` / `onManageTracker` open
// those sheets.
export default function SideMenu({ onClose, onNewTracker, onManageTracker }) {
  const { user, logout } = useAuth();
  const { settings, update } = useSettings();
  const { trackers, activeId, pro, switchTo } = useTracker();
  const { ent } = usePlan();
  const navigate = useNavigate();
  const isPro = ent ? !!ent.pro : !!pro;
  const currency = settings?.currency || 'GBP';
  const staking = settings?.staking;
  const dark = settings?.theme?.mode !== 'light';

  // A quick read on the tracker you're in. Shown instantly from cache, then refreshed.
  const [stats, setStats] = useState(() => getCached('menuStats:' + activeId) ?? null);
  useEffect(() => {
    if (!activeId) return;
    setStats(getCached('menuStats:' + activeId) ?? null);
    let off = false;
    api.get(`/bets/stats?tracker=${activeId}`)
      .then((d) => { if (!off) { setStats(d.stats); setCached('menuStats:' + activeId, d.stats); } })
      .catch(() => {});
    return () => { off = true; };
  }, [activeId]);

  const go = (path) => () => { onClose(); navigate(path); };
  const signOut = () => { onClose(); logout(); navigate('/'); };
  const setMode = (mode) => { if (settings && (settings.theme?.mode || 'dark') !== mode) update({ theme: { ...settings.theme, mode } }); };

  const net = stats ? amountParts(stats.netProfit, currency, staking, { signed: true, units: stats.netProfitU }).main : null;
  const netCls = stats && stats.netProfit > 0 ? 'pos' : stats && stats.netProfit < 0 ? 'neg' : '';
  const billing = ent?.billing;
  const trial = billing?.trialDays > 0;

  return (
    <>
      <div className="drawer-head">
        <Logo />
        <button className="sm-close" type="button" onClick={onClose} aria-label="Close menu">✕</button>
      </div>

      {/* Who you are */}
      <button type="button" className="sm-profile" onClick={go('/account')}>
        <span className="sm-avatar" aria-hidden="true">{initialsOf(user?.username)}</span>
        <span className="sm-id">
          <span className="sm-name">{user?.username}</span>
          <span className="sm-email">{user?.email}</span>
        </span>
        <span className={`badge sm-plan ${isPro ? 'won' : ''}`} style={{ textTransform: 'none' }}>{isPro ? 'Pro' : 'Free'}</span>
      </button>

      {/* Trackers */}
      <div className="sm-section">
        <span>{trackers.length > 1 ? `Your trackers · ${trackers.length}` : 'Your tracker'}</span>
        <button type="button" className="sm-mini" onClick={onManageTracker}><Icon name="edit" size={13} /> Edit</button>
      </div>
      <div className="drawer-list">
        {trackers.map((t) => {
          const on = t.id === activeId;
          return (
            <button key={t.id} type="button" className={'drawer-item' + (on ? ' on' : '')} onClick={() => { switchTo(t.id); onClose(); }} aria-current={on ? 'true' : undefined}>
              <span className="di-ic"><Icon name="layers" size={18} /></span>
              <span className="di-main">
                <span className="di-name">{t.name}</span>
                {on && stats && (
                  <span className="di-sub">
                    <span className={netCls}>{net}</span> · {stats.totalBets} bet{stats.totalBets === 1 ? '' : 's'}
                  </span>
                )}
              </span>
              {on && <Icon name="check" size={17} className="di-check" />}
            </button>
          );
        })}
        <button className="drawer-item drawer-new" type="button" onClick={onNewTracker}>
          <span className="di-ic di-ic-add"><Icon name="plus" size={17} /></span>
          <span className="di-main"><span className="di-name">New tracker</span></span>
          {!pro && <span className="pro-pill">Pro</span>}
        </button>
      </div>

      {/* Go Pro (free accounts) */}
      {!isPro && (
        <button type="button" className="sm-upgrade" onClick={go('/pricing')}>
          <span className="sm-up-ic"><Icon name="zap" size={18} /></span>
          <span className="sm-up-txt">
            <strong>{trial ? `Try Pro free for ${billing.trialDays} days` : 'Go Pro'}</strong>
            <span>{billing?.priceLabel ? `${billing.priceLabel} · ` : ''}Full stats, unlimited scans, more trackers</span>
          </span>
          <Icon name="chevron" size={16} className="sm-chev" />
        </button>
      )}

      {/* Quick preferences */}
      <div className="sm-prefs">
        <div className="sm-pref">
          <span className="sm-pref-label">Appearance</span>
          <div className="sm-seg" role="group" aria-label="Appearance">
            <button type="button" className={dark ? 'on' : ''} onClick={() => setMode('dark')} aria-pressed={dark}><Icon name="moon" size={15} /> Dark</button>
            <button type="button" className={!dark ? 'on' : ''} onClick={() => setMode('light')} aria-pressed={!dark}><Icon name="sun" size={15} /> Light</button>
          </div>
        </div>
        <div className="sm-pref">
          <span className="sm-pref-label">App</span>
          <InstallStatus />
        </div>
      </div>

      {/* Footer */}
      <div className="drawer-foot">
        <button className="drawer-link sm-logout" type="button" onClick={signOut}>
          <Icon name="logout" size={19} /> Log out
        </button>
        <div className="sm-legal">
          <button type="button" onClick={go('/terms')}>Terms</button>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={go('/privacy')}>Privacy</button>
          <span aria-hidden="true">·</span>
          <a href="https://www.begambleaware.org/" target="_blank" rel="noopener noreferrer">BeGambleAware</a>
        </div>
      </div>
    </>
  );
}
