import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Toggle from '../components/Toggle.jsx';
import Spinner from '../components/Spinner.jsx';
import { STAT_META } from '../components/StatCard.jsx';
import { currencySymbol } from '../format.js';
import { THEME_PRESETS, THEME_STYLES, matchPreset } from '../themes.js';

const PRESET_COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#f59e0b', '#ef4444', '#14b8a6', '#eab308', '#6366f1', '#f97316'];
const FONTS = [
  { key: 'system', label: 'System' },
  { key: 'rounded', label: 'Rounded' },
  { key: 'mono', label: 'Mono' },
  { key: 'serif', label: 'Serif' },
];
const FIELD_LABELS = {
  sport: 'Sport / Category', event: 'Event', selection: 'Selection', betType: 'Bet type',
  bookmaker: 'Bookmaker', tipster: 'Tipster', stake: 'Stake', odds: 'Odds', status: 'Status',
  payout: 'Payout / Return', notes: 'Notes', tags: 'Tags',
};

export default function Customise() {
  const { settings, update, save } = useSettings();
  const toast = useToast();
  const [share, setShare] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { api.get('/share/me').then((d) => setShare(d.share)); }, []);

  if (!settings) return <div className="main"><Spinner /></div>;

  const t = settings.theme;
  const setTheme = (patch) => update({ theme: { ...t, ...patch } });

  const setDefault = (k, v) => update({ defaults: { ...settings.defaults, [k]: v } });
  const toggleField = (k, v) => update({ fields: { ...settings.fields, [k]: v } });
  const toggleWidget = (k, v) => update({ widgets: { ...settings.widgets, [k]: v } });
  const toggleSharing = (k, v) => update({ sharing: { ...settings.sharing, [k]: v } });

  function setCard(key, enabled) {
    update({ statCards: settings.statCards.map((c) => (c.key === key ? { ...c, enabled } : c)) });
  }
  function moveCard(idx, dir) {
    const arr = [...settings.statCards];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    update({ statCards: arr });
  }

  async function enableShare() {
    try {
      const d = await api.post('/share/enable');
      setShare(d.share);
      toast('Share link created', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }
  async function disableShare() {
    try {
      await api.post('/share/disable');
      setShare((s) => ({ ...s, enabled: false }));
      toast('Sharing turned off');
    } catch (e) { toast(e.message, 'error'); }
  }
  const shareUrl = share?.publicId ? `${window.location.origin}/share/${share.publicId}` : '';
  function copyLink() {
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    toast('Link copied', 'success');
    setTimeout(() => setCopied(false), 1500);
  }

  async function resetAll() {
    if (!confirm('Reset all customisation to defaults?')) return;
    const d = await api.post('/settings/reset');
    await save(d.settings);
    toast('Reset to defaults');
  }

  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h1>Customise</h1>
          <p>Make the tracker yours — colours, layout, and what you track.</p>
        </div>
        <button className="btn-ghost" onClick={resetAll}>Reset to defaults</button>
      </div>

      {/* Units & staking */}
      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">Units &amp; staking</h3>
        <div className="grid-2">
          <div className="field">
            <label>Currency</label>
            <select value={settings.currency} onChange={(e) => update({ currency: e.target.value })}>
              {['GBP', 'USD', 'EUR', 'AUD', 'CAD'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Odds format</label>
            <select value={settings.oddsFormat} onChange={(e) => update({ oddsFormat: e.target.value })}>
              <option value="decimal">Decimal (2.50)</option>
              <option value="fractional">Fractional (6/4)</option>
              <option value="american">American (+150)</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 6, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Some bettors stake in units (e.g. 1 unit = a fixed amount). Choose how stakes and profit are shown and entered.
          </p>
          <div className="grid-2">
            <div className="field">
              <label>Show stakes &amp; profit as</label>
              <select value={settings.staking.mode} onChange={(e) => update({ staking: { ...settings.staking, mode: e.target.value } })}>
                <option value="currency">Currency ({currencySymbol(settings.currency)})</option>
                <option value="units">Units</option>
                <option value="both">Both (money &amp; units)</option>
              </select>
            </div>
            <div className="field">
              <label>1 unit equals</label>
              <div className="row" style={{ gap: 8 }}>
                <span className="muted" style={{ fontWeight: 700 }}>{currencySymbol(settings.currency)}</span>
                <input
                  type="number" min="0.01" step="0.01" value={settings.staking.unitSize}
                  onChange={(e) => update({ staking: { ...settings.staking, unitSize: Number(e.target.value) || 0 } })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New-bet defaults */}
      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">New bet defaults</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Pre-fill the add-bet form with your usual values. Leave blank for none.</p>
        <div className="grid-2">
          <div className="field">
            <label>Default stake{settings.staking.mode !== 'currency' ? ' (units)' : ''}</label>
            <input
              type="number" min="0" step="0.01" value={settings.defaults.stake}
              placeholder={settings.staking.mode !== 'currency' ? '2' : '10.00'}
              onChange={(e) => setDefault('stake', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Default bookmaker</label>
            <input value={settings.defaults.bookmaker} placeholder="e.g. Bet365" onChange={(e) => setDefault('bookmaker', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">Appearance</h3>

        <div className="field">
          <label>Theme</label>
          <p className="muted" style={{ marginTop: 0, marginBottom: 10, fontSize: 13 }}>Pick a look to start from — tweak the details below.</p>
          <div className="theme-presets">
            {THEME_PRESETS.map((p) => {
              const active = matchPreset(t) === p.key;
              const pt = p.theme;
              const st = THEME_STYLES[pt.style] || THEME_STYLES.soft;
              const light = pt.mode === 'light';
              const cardBg = light ? '#f4f6fb' : pt.background;
              const cardSurface = light ? '#ffffff' : pt.surface;
              const cardBorder = light ? '#dde3ec' : '#20304d';
              const cardText = light ? '#131722' : '#e6edf7';
              const cardMuted = light ? '#5b6675' : '#8a97ab';
              return (
                <button
                  key={p.key}
                  type="button"
                  className={`theme-card ${active ? 'active' : ''}`}
                  onClick={() => setTheme(pt)}
                  style={{ background: cardBg, borderColor: active ? pt.primary : cardBorder, borderRadius: `calc(${st.radius} + 4px)` }}
                >
                  <div className="theme-card-preview" style={{ background: cardSurface, border: st.cardBorder.replace('var(--border)', cardBorder).replace('var(--accent)', pt.accent).replace('var(--primary)', pt.primary), borderRadius: st.radius, boxShadow: light ? 'none' : st.cardShadow.replace('var(--primary)', pt.primary).replace('var(--accent)', pt.accent) }}>
                    <span className="theme-dot" style={{ background: pt.primary }} />
                    <span className="theme-dot" style={{ background: pt.accent }} />
                    <span className="theme-bar" style={{ background: pt.primary }} />
                    <span className="theme-bar short" style={{ background: cardMuted }} />
                  </div>
                  <div className="theme-card-meta">
                    <strong style={{ color: cardText, fontFamily: st.headFont, textTransform: st.headTransform, letterSpacing: st.headSpacing }}>{p.name}</strong>
                    <span style={{ color: cardMuted }}>{p.blurb}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <label>Mode</label>
          <div className="row">
            <button className={t.mode === 'dark' ? 'btn-accent btn-sm' : 'btn-ghost btn-sm'} onClick={() => setTheme({ mode: 'dark' })}>Dark</button>
            <button className={t.mode === 'light' ? 'btn-accent btn-sm' : 'btn-ghost btn-sm'} onClick={() => setTheme({ mode: 'light' })}>Light</button>
          </div>
        </div>

        <div className="field">
          <label>Dashboard colour</label>
          <div className="swatches">
            {PRESET_COLORS.map((c) => (
              <div key={c} className={`swatch ${t.primary === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setTheme({ primary: c })} />
            ))}
            <input type="color" value={t.primary} onChange={(e) => setTheme({ primary: e.target.value })} style={{ width: 44, height: 34, padding: 2 }} title="Custom colour" />
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Accent colour</label>
            <div className="row">
              <input type="color" value={t.accent} onChange={(e) => setTheme({ accent: e.target.value })} style={{ width: 50, height: 40, padding: 2 }} />
              <span className="muted">{t.accent}</span>
            </div>
          </div>
          {t.mode === 'dark' && (
            <div className="field">
              <label>Background</label>
              <div className="row">
                <input type="color" value={t.background} onChange={(e) => setTheme({ background: e.target.value })} style={{ width: 50, height: 40, padding: 2 }} />
                <span className="muted">{t.background}</span>
              </div>
            </div>
          )}
        </div>

        <div className="field">
          <label>Font</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {FONTS.map((f) => (
              <button key={f.key} className={t.font === f.key ? 'btn-accent btn-sm' : 'btn-ghost btn-sm'} onClick={() => setTheme({ font: f.key })}>{f.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">Dashboard stats</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Choose which numbers to show and reorder them.</p>
        {settings.statCards.map((c, i) => (
          <div key={c.key} className="toggle-row">
            <div className="row">
              <div className="stack" style={{ gap: 2 }}>
                <button className="btn-ghost btn-sm" style={{ padding: '0 6px', lineHeight: 1.1 }} onClick={() => moveCard(i, -1)} disabled={i === 0}>▲</button>
                <button className="btn-ghost btn-sm" style={{ padding: '0 6px', lineHeight: 1.1 }} onClick={() => moveCard(i, 1)} disabled={i === settings.statCards.length - 1}>▼</button>
              </div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{STAT_META[c.key]?.label || c.key}</span>
            </div>
            <label className="switch">
              <input type="checkbox" checked={c.enabled} onChange={(e) => setCard(c.key, e.target.checked)} />
              <span className="slider" />
            </label>
          </div>
        ))}
      </div>

      {/* Widgets */}
      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">Dashboard sections</h3>
        <Toggle label="Bankroll" description="Balance & growth (needs a starting bankroll)" checked={settings.widgets.bankroll !== false} onChange={(v) => toggleWidget('bankroll', v)} />
        <Toggle label="Open bets list" checked={settings.widgets.pendingBets !== false} onChange={(v) => toggleWidget('pendingBets', v)} />
        <Toggle label="Profit-over-time chart" checked={settings.widgets.profitChart} onChange={(v) => toggleWidget('profitChart', v)} />
        <Toggle label="By sport / category breakdown" checked={settings.widgets.sportBreakdown} onChange={(v) => toggleWidget('sportBreakdown', v)} />
        <Toggle label="Recent bets list" checked={settings.widgets.recentBets} onChange={(v) => toggleWidget('recentBets', v)} />
      </div>

      {/* Fields */}
      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">What to track</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Hidden fields disappear from the bet form and table.</p>
        {Object.keys(FIELD_LABELS).map((k) => (
          <Toggle key={k} label={FIELD_LABELS[k]} checked={settings.fields[k]} onChange={(v) => toggleField(k, v)} />
        ))}
      </div>

      {/* Sharing */}
      <div className="card">
        <h3 className="section-title">Sharing</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Publish a read-only page of how you're getting on.</p>

        <div className="field">
          <label>Display name on your public page</label>
          <input value={settings.sharing.displayName} placeholder="Defaults to your username" onChange={(e) => toggleSharing('displayName', e.target.value)} />
        </div>

        <Toggle label="Show net profit" checked={settings.sharing.showProfit} onChange={(v) => toggleSharing('showProfit', v)} />
        <Toggle label="Show ROI" checked={settings.sharing.showRoi} onChange={(v) => toggleSharing('showRoi', v)} />
        <Toggle label="Show win rate" checked={settings.sharing.showWinRate} onChange={(v) => toggleSharing('showWinRate', v)} />
        <Toggle label="Show stake amounts" description="Off by default to keep your money private" checked={settings.sharing.showStakes} onChange={(v) => toggleSharing('showStakes', v)} />
        <Toggle label="Show recent bets" checked={settings.sharing.showRecentBets} onChange={(v) => toggleSharing('showRecentBets', v)} />

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          {share?.enabled ? (
            <>
              <label>Your public link</label>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <input readOnly value={shareUrl} style={{ flex: 1, minWidth: 220 }} onFocus={(e) => e.target.select()} />
                <button className="btn-primary btn-sm" onClick={copyLink}>{copied ? 'Copied!' : 'Copy'}</button>
                <a className="btn-ghost btn-sm" href={shareUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>Open</a>
                <button className="btn-danger btn-sm" onClick={disableShare}>Stop sharing</button>
              </div>
            </>
          ) : (
            <button className="btn-primary" onClick={enableShare}>Create a share link</button>
          )}
        </div>
      </div>
    </div>
  );
}
