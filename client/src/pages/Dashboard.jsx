import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { api } from '../api.js';
import { useSettings } from '../context/SettingsContext.jsx';
import { useTracker } from '../context/TrackerContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import StatCard from '../components/StatCard.jsx';
import SettleControls from '../components/SettleControls.jsx';
import PendingReminder from '../components/PendingReminder.jsx';
import BetPreview from '../components/BetPreview.jsx';
import InstallBanner from '../components/InstallBanner.jsx';
import Spinner from '../components/Spinner.jsx';
import Icon from '../components/Icon.jsx';
import { settlePayout } from '../settle.js';
import { getCached, setCached, subscribeInvalidate } from '../dataCache.js';
import { markAppReady } from '../boot.js';
import { useAddBet } from '../context/AddBetContext.jsx';
import { usePlan } from '../usePlan.js';
import { formatStake, formatOdds, formatDate, units, money } from '../format.js';

// A stat value that shrinks its font-size to fit its tile, so long numbers
// (e.g. "+£1,523.52") never overflow or clip regardless of how many tiles are
// on screen. Scales between `min` and `max` px based on the actual width.
function FitValue({ children, className = '', max = 20, min = 10 }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let size = max;
      el.style.fontSize = size + 'px';
      // Shrink until the (nowrap) text stops overflowing its box.
      while (size > min && el.scrollWidth > el.clientWidth) {
        size -= 0.5;
        el.style.fontSize = size + 'px';
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, max, min]);
  return <div ref={ref} className={className}>{children}</div>;
}

const SETTLED = ['won', 'lost', 'void', 'cashout', 'placed'];
const DASH_RANGES = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: 'all', label: 'All time', days: null },
];

const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const betDate = (b) => new Date((b.placed_at || '').length <= 10 ? (b.placed_at || '') + 'T00:00:00' : b.placed_at);

function betProfit(b) {
  if (b.status === 'won') return (b.payout ?? b.stake * b.odds) - b.stake;
  if (b.status === 'lost') return -b.stake;
  if (b.status === 'placed') return (b.payout ?? 0) - b.stake;
  if (b.status === 'void' || b.status === 'cashout') return (b.payout ?? b.stake) - b.stake;
  return 0; // pending
}

// All the headline metrics for a set of bets (already filtered to a window).
function computeMetrics(list) {
  const settled = list.filter((b) => SETTLED.includes(b.status));
  const profit = settled.reduce((s, b) => s + betProfit(b), 0);
  const staked = settled.reduce((s, b) => s + b.stake, 0);
  const decisive = settled.filter((b) => b.status === 'won' || b.status === 'lost');
  const wins = decisive.filter((b) => b.status === 'won').length;
  const winRate = decisive.length ? (wins / decisive.length) * 100 : 0;
  const avgStake = settled.length ? staked / settled.length : 0;
  const profits = settled.map(betProfit);
  const biggestWin = profits.length ? Math.max(0, ...profits) : 0;
  const biggestLoss = profits.length ? Math.min(0, ...profits) : 0;

  // Streaks over decisive bets, chronological.
  const ordered = decisive.slice().sort((a, b) => betDate(a) - betDate(b));
  let longestWin = 0, run = 0, current = 0, currentType = null;
  for (const b of ordered) {
    if (b.status === 'won') { run++; longestWin = Math.max(longestWin, run); } else run = 0;
  }
  for (let i = ordered.length - 1; i >= 0; i--) {
    const t = ordered[i].status;
    if (currentType === null) { currentType = t; current = 1; }
    else if (t === currentType) current++;
    else break;
  }

  // Cumulative profit timeline for the chart.
  const timeline = [];
  let running = 0;
  for (const b of settled.slice().sort((a, b) => betDate(a) - betDate(b))) {
    running += betProfit(b);
    timeline.push({ date: (b.placed_at || '').slice(0, 10), profit: Number(running.toFixed(2)) });
  }

  const roi = staked > 0 ? (profit / staked) * 100 : 0;
  return {
    profit: Number(profit.toFixed(2)), staked, roi: Number(roi.toFixed(1)), winRate: Number(winRate.toFixed(1)),
    totalBets: list.length, settled: settled.length, avgStake, biggestWin: Number(biggestWin.toFixed(2)),
    biggestLoss: Number(biggestLoss.toFixed(2)), longestWin, current, currentType, timeline,
  };
}

// The catalog of tiles a user can put on their dashboard (label + icon). The
// value/delta for each is built in tileData() from the computed metrics.
export const TILE_CATALOG = [
  { key: 'netProfit', label: 'Net Profit', icon: 'trend' },
  { key: 'roi', label: 'ROI', icon: 'trend' },
  { key: 'winRate', label: 'Win Rate', icon: 'target' },
  { key: 'totalBets', label: 'Total Bets', icon: 'coins' },
  { key: 'avgStake', label: 'Avg. Stake', icon: 'clock' },
  { key: 'totalStaked', label: 'Total Staked', icon: 'coins' },
  { key: 'biggestWin', label: 'Best Win', icon: 'trophy' },
  { key: 'biggestLoss', label: 'Biggest Loss', icon: 'target' },
  { key: 'currentStreak', label: 'Current Streak', icon: 'calendar' },
  { key: 'longestWin', label: 'Longest Streak', icon: 'analytics' },
  { key: 'pending', label: 'Open Bets', icon: 'clock' },
];

export default function Dashboard() {
  const { settings, update } = useSettings();
  const { active, activeId } = useTracker();
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { openAddBet } = useAddBet();
  const { ent } = usePlan();
  const [stats, setStats] = useState(() => getCached('dash:' + activeId)?.stats ?? null);
  const [bets, setBets] = useState(() => getCached('dash:' + activeId)?.bets ?? []);
  const [loading, setLoading] = useState(() => !getCached('dash:' + activeId));
  const [range, setRange] = useState('30d');
  const [chartRange, setChartRange] = useState('30d');
  const [editTiles, setEditTiles] = useState(false);
  const [preview, setPreview] = useState(null); // tapped recent bet — full breakdown

  const load = useCallback(() => {
    const q = activeId ? `?tracker=${activeId}` : '';
    return Promise.all([
      api.get('/bets/stats' + q).then((d) => d.stats),
      api.get('/bets' + q).then((d) => d.bets),
    ]).then(([s, b]) => {
      setStats(s); setBets(b);
      setCached('dash:' + activeId, { stats: s, bets: b });
    });
  }, [activeId]);
  useEffect(() => {
    if (!activeId) return;
    const cached = getCached('dash:' + activeId);
    if (cached) { setStats(cached.stats); setBets(cached.bets); setLoading(false); }
    else setLoading(true);
    load().finally(() => setLoading(false));
  }, [activeId, load]);
  useEffect(() => subscribeInvalidate(() => load()), [load]);

  // Straight after onboarding ("Add my first bet"), open the Add-bet slip once.
  useEffect(() => {
    if (params.get('firstbet') === '1') {
      openAddBet();
      params.delete('firstbet');
      setParams(params, { replace: true });
    }
  }, [params, setParams, openAddBet]);

  // Filter the bets to a range, and compute this-period + previous-period metrics.
  const windowFor = useCallback((key) => {
    const r = DASH_RANGES.find((x) => x.key === key) || DASH_RANGES[1];
    if (!r.days) return { list: bets, prev: null };
    const start = new Date(); start.setDate(start.getDate() - (r.days - 1)); start.setHours(0, 0, 0, 0);
    const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - r.days);
    const from = isoLocal(start);
    const prevFrom = isoLocal(prevStart);
    const list = bets.filter((b) => (b.placed_at || '') >= from);
    const prev = bets.filter((b) => (b.placed_at || '') >= prevFrom && (b.placed_at || '') < from);
    return { list, prev };
  }, [bets]);

  const cur = useMemo(() => windowFor(range), [windowFor, range]);
  const m = useMemo(() => computeMetrics(cur.list), [cur.list]);
  const prevM = useMemo(() => (cur.prev && cur.prev.length ? computeMetrics(cur.prev) : null), [cur.prev]);
  const chartM = useMemo(() => computeMetrics(windowFor(chartRange).list), [windowFor, chartRange]);

  async function settle(bet, status) {
    try {
      await api.put(`/bets/${bet.id}`, { ...bet, status, payout: settlePayout(bet, status) });
      await load();
      toast(`Marked ${status}`);
    } catch (e) { toast(e.message, 'error'); }
  }

  // Dashboard is the default landing screen: once its first data is in, the
  // boot splash can fade — so startup is one screen, not splash → spinner.
  useEffect(() => {
    if (settings && !loading && stats) markAppReady();
  }, [settings, loading, stats]);

  if (!settings || loading || !stats) return <div className="main"><Spinner /></div>;

  const currency = settings.currency;
  const staking = settings.staking;
  const unitSize = Number(staking?.unitSize) || 0;
  const showUnits = (staking?.mode || 'currency') === 'currency' && unitSize > 0;
  const enabledCards = settings.statCards.filter((c) => c.enabled);
  const pending = bets.filter((b) => b.status === 'pending');

  // First-run onboarding: guide brand-new accounts before there's any data.
  if (stats.totalBets === 0) {
    const firstName = (user?.username || settings.sharing?.displayName || '').trim().split(/\s+/)[0];
    return (
      <div className="main">
        <InstallBanner />
        <div className="page-head">
          <div>
            <h1>Welcome{firstName ? `, ${firstName}` : ''}</h1>
            <p>Get your first bet in — everything fills in from there.</p>
          </div>
        </div>

        {/* Hero: the one action that matters first — log (or scan) a bet. */}
        <div className="card gs-hero">
          <div className="gs-hero-ic"><Icon name="camera" size={22} /></div>
          <h3>Add your first bet</h3>
          <p>Snap a photo of your slip and we’ll read it for you, or add it by hand. We work out your profit, ROI and win rate automatically.</p>
          <button type="button" onClick={() => openAddBet()} className="btn-primary">+ Add a bet</button>
        </div>

        <div className="gs-list">
          <div className="gs-card">
            <div className="gs-num">1</div>
            <div className="gs-content">
              <h4>Make it yours</h4>
              <p>Pick your currency and odds format, then choose the stats you want front and centre on your dashboard.</p>
              <Link to="/customise" className="btn-ghost btn-sm">Customise</Link>
            </div>
          </div>
          <div className="gs-card">
            <div className="gs-num">2</div>
            <div className="gs-content">
              <h4>Track by the day</h4>
              <p>Log a few bets and your profit chart, win rate and streaks build up automatically — no spreadsheets.</p>
              <Link to="/analytics" className="btn-ghost btn-sm">See your stats</Link>
            </div>
          </div>
          <div className="gs-card">
            <div className="gs-num">3</div>
            <div className="gs-content">
              <h4>Share your record</h4>
              <p>When you’re ready, publish a clean, read-only page of how you’re getting on.</p>
              <Link to="/customise" className="btn-ghost btn-sm">Set up sharing</Link>
            </div>
          </div>
        </div>
        {enabledCards.length > 0 && (
          <>
            <h3 className="section-title" style={{ marginTop: 26 }}>Your dashboard</h3>
            <div className="stat-grid">
              {enabledCards.map((c) => <StatCard key={c.key} statKey={c.key} stats={stats} currency={currency} staking={staking} />)}
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>These fill in as soon as you start logging bets.</p>
          </>
        )}
        <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 22 }}>Please gamble responsibly.</p>
      </div>
    );
  }

  const pcls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
  const unitsOf = (v) => units(unitSize > 0 ? v / unitSize : 0, { signed: true });
  // Unit amount for a stake tile — shown as a sub-line when the user stakes in
  // units or both, so the tile's main value stays a short money figure.
  const unitStakeSub = (v) => {
    const mode = staking?.mode || 'currency';
    if (unitSize <= 0 || mode === 'currency' || v == null) return null;
    return units(v / unitSize);
  };

  // Period-over-period deltas (only when there's a comparable previous period).
  const delta = prevM ? {
    winRate: m.winRate - prevM.winRate,
    totalBets: m.totalBets - prevM.totalBets,
    avgStake: m.avgStake - prevM.avgStake,
  } : null;
  const Delta = ({ v, fmt }) => {
    if (!delta || v === 0) return <span className="dstat-sub muted">—</span>;
    const cls = v > 0 ? 'pos' : 'neg';
    return <span className={`dstat-sub ${cls}`}>{v > 0 ? '▲' : '▼'} {fmt(Math.abs(v))}</span>;
  };

  const recent = bets.slice(0, 5);
  const chartData = chartM.timeline;
  const pendingStake = pending.reduce((s, b) => s + b.stake, 0);

  // The user's chosen dashboard tiles (2–4), validated against the catalog.
  const dashTiles = (Array.isArray(settings.dashTiles) && settings.dashTiles.length >= 2
    ? settings.dashTiles : ['netProfit', 'winRate', 'totalBets', 'avgStake'])
    .filter((k) => TILE_CATALOG.some((t) => t.key === k)).slice(0, 4);
  const toggleTile = (key) => {
    let next;
    if (dashTiles.includes(key)) { if (dashTiles.length <= 2) return; next = dashTiles.filter((k) => k !== key); }
    else { if (dashTiles.length >= 4) return; next = [...dashTiles, key]; }
    update({ dashTiles: next });
  };
  // Build a tile's value + sub/delta from the computed metrics.
  function tileData(key) {
    const meta = TILE_CATALOG.find((t) => t.key === key) || {};
    const base = { label: meta.label, icon: meta.icon };
    switch (key) {
      case 'netProfit': return { ...base, value: money(m.profit, currency, { signed: true }), valCls: pcls(m.profit), sub: showUnits ? unitsOf(m.profit) : null, subCls: pcls(m.profit) };
      case 'roi': return { ...base, value: `${m.roi}%`, valCls: pcls(m.roi) };
      case 'winRate': return { ...base, value: `${m.winRate}%`, delta: delta?.winRate, deltaFmt: (x) => `${x.toFixed(0)}%` };
      case 'totalBets': return { ...base, value: m.totalBets, delta: delta?.totalBets, deltaFmt: (x) => `${x}` };
      // Tiles are narrow, so show a compact money value (not the long
      // "money · units" dual form) — the units read is available on Stats.
      case 'avgStake': return { ...base, value: money(m.avgStake, currency), sub: unitStakeSub(m.avgStake), delta: unitStakeSub(m.avgStake) ? undefined : delta?.avgStake, deltaFmt: (x) => money(x, currency) };
      case 'totalStaked': return { ...base, value: money(m.staked, currency), sub: unitStakeSub(m.staked) };
      case 'biggestWin': return { ...base, value: money(m.biggestWin, currency, { signed: true }), valCls: 'pos', sub: showUnits ? unitsOf(m.biggestWin) : null, subCls: 'pos' };
      case 'biggestLoss': return { ...base, value: money(m.biggestLoss, currency, { signed: true }), valCls: 'neg', sub: showUnits ? unitsOf(m.biggestLoss) : null, subCls: 'neg' };
      case 'currentStreak': return { ...base, value: m.current, valCls: m.currentType === 'won' ? 'pos' : m.currentType === 'lost' ? 'neg' : '', sub: m.currentType === 'won' ? 'wins' : m.currentType === 'lost' ? 'losses' : '—' };
      case 'longestWin': return { ...base, value: m.longestWin, sub: 'wins' };
      case 'pending': return { ...base, value: pending.length, sub: formatStake(pendingStake, currency, staking) };
      default: return base;
    }
  }

  return (
    <div className="main">
      <InstallBanner />
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <h1>Dashboard</h1>
          <p>Your betting performance at a glance.</p>
        </div>
        <label className="range-pill">
          <Icon name="calendar" size={15} />
          <select value={range} onChange={(e) => { setRange(e.target.value); setChartRange(e.target.value); }}>
            {DASH_RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <Icon name="chevron" size={14} />
        </label>
      </div>

      {ent && !ent.pro && (
        <Link to="/pricing" className="go-pro">
          <span className="gp-ic"><Icon name="zap" size={18} /></span>
          <span className="gp-txt"><strong>Unlock Pro</strong><span>Unlimited scans, advanced stats &amp; more</span></span>
          <span className="gp-cta">See plans</span>
        </Link>
      )}

      <PendingReminder bets={bets} onReview={() => navigate('/bets')} reviewLabel="Show open bets" />

      {/* Stat tiles — choosable */}
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 6 }}>
        <button type="button" className="tile-edit" onClick={() => setEditTiles(true)}><Icon name="edit" size={13} /> Edit tiles</button>
      </div>
      <div className="dstat-grid" style={{ gridTemplateColumns: `repeat(${dashTiles.length}, 1fr)` }}>
        {dashTiles.map((key, i) => {
          const td = tileData(key);
          return (
            <div key={key} className={`dstat ${i === 0 ? 'primary' : ''}`}>
              <div className="dstat-top"><span className="dstat-ic"><Icon name={td.icon} size={16} /></span></div>
              <div className="dstat-label">{td.label}</div>
              <FitValue className={`dstat-val ${td.valCls || ''}`}>{td.value}</FitValue>
              {td.sub != null
                ? <span className={`dstat-sub ${td.subCls || 'muted'}`}>{td.sub}</span>
                : td.delta !== undefined
                  ? <Delta v={td.delta ?? 0} fmt={td.deltaFmt} />
                  : <span className="dstat-sub muted">—</span>}
            </div>
          );
        })}
      </div>

      {editTiles && createPortal(
        <div className="modal-overlay" onMouseDown={() => setEditTiles(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="row spread" style={{ marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Dashboard tiles</h2>
              <button className="btn-ghost btn-sm" onClick={() => setEditTiles(false)}>Done</button>
            </div>
            <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>Choose 2–4 stats to show at the top of your dashboard.</p>
            <div className="stack" style={{ gap: 0 }}>
              {TILE_CATALOG.map((t) => {
                const on = dashTiles.includes(t.key);
                const disabled = (!on && dashTiles.length >= 4) || (on && dashTiles.length <= 2);
                return (
                  <button key={t.key} type="button" className={`tile-pick ${on ? 'on' : ''}`} disabled={disabled} onClick={() => toggleTile(t.key)}>
                    <span className="sr-ic"><Icon name={t.icon} size={16} /></span>
                    <span className="tile-pick-label">{t.label}</span>
                    <span className="tile-pick-check">{on && <Icon name="check" size={16} />}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Profit Overview */}
      <div className="card perf-card">
        <div className="perf-card-head static">
          <span className="pch-title"><Icon name="trend" size={18} /> Profit Overview</span>
          <div className="seg-mini">
            {['7d', '30d', 'all'].map((k) => (
              <button key={k} type="button" className={chartRange === k ? 'on' : ''} onClick={() => setChartRange(k)}>{k === 'all' ? 'ALL' : k.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div className="po-body">
          <div className="po-figures">
            <span className="po-label">Total Profit</span>
            <span className={`po-big ${pcls(chartM.profit)}`}>{money(chartM.profit, currency, { signed: true })}</span>
            {showUnits && <span className={`po-sub ${pcls(chartM.profit)}`}>{unitsOf(chartM.profit)}</span>}
          </div>
          <div className="po-chart">
            {chartData.length >= 2 ? (
              <ResponsiveContainer width="100%" height={170}>
                <AreaChart data={chartData} margin={{ top: 8, right: 6, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="dashFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted)" fontSize={10.5} tickLine={false} axisLine={false}
                    tickFormatter={(d) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    minTickGap={40} />
                  <YAxis stroke="var(--muted)" fontSize={10.5} tickLine={false} axisLine={false} width={42} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 12 }}
                    labelFormatter={(d) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    formatter={(v) => [money(v, currency, { signed: true }), 'Profit']} />
                  <ReferenceLine y={0} stroke="var(--muted)" strokeOpacity={0.5} />
                  <Area type="monotone" dataKey="profit" stroke="var(--primary)" strokeWidth={2.5} fill="url(#dashFill)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="po-empty muted">Not enough settled bets in this range to chart yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats — deeper stats (Pro). Free accounts see a locked teaser. */}
      <div className="card perf-card">
        <div className="perf-card-head static"><span className="pch-title">Quick Stats</span></div>
        <div className={`qs-wrap${ent && !ent.pro ? ' locked' : ''}`}>
          <div className="qs-grid" aria-hidden={ent && !ent.pro ? 'true' : undefined}>
            <div className="qs">
              <span className="qs-ic"><Icon name="trophy" size={16} /></span>
              <span className="qs-label">Best Win</span>
              <span className="qs-val pos">{money(m.biggestWin, currency, { signed: true })}</span>
              {showUnits && <span className="qs-sub">({unitsOf(m.biggestWin).replace('+', '')})</span>}
            </div>
            <div className="qs">
              <span className="qs-ic"><Icon name="target" size={16} /></span>
              <span className="qs-label">Biggest Loss</span>
              <span className="qs-val neg">{money(m.biggestLoss, currency, { signed: true })}</span>
              {showUnits && <span className="qs-sub">({unitsOf(m.biggestLoss).replace('-', '')})</span>}
            </div>
            <div className="qs">
              <span className="qs-ic"><Icon name="analytics" size={16} /></span>
              <span className="qs-label">Longest Win Streak</span>
              <span className="qs-val">{m.longestWin}</span>
              <span className="qs-sub">(bets)</span>
            </div>
            <div className="qs">
              <span className="qs-ic"><Icon name="calendar" size={16} /></span>
              <span className="qs-label">Current Streak</span>
              <span className={`qs-val ${m.currentType === 'won' ? 'pos' : m.currentType === 'lost' ? 'neg' : ''}`}>{m.current}</span>
              <span className="qs-sub">({m.currentType === 'won' ? 'wins' : m.currentType === 'lost' ? 'losses' : '—'})</span>
            </div>
          </div>
          {ent && !ent.pro && (
            <div className="qs-lock">
              <span className="qs-lock-ic"><Icon name="lock" size={20} /></span>
              <span className="qs-lock-txt">Deeper stats — best win, biggest loss &amp; streaks</span>
              <Link to="/pricing" className="btn-primary btn-sm">Unlock with Pro</Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card perf-card">
        <div className="perf-card-head static">
          <span className="pch-title"><Icon name="clock" size={17} /> Recent Activity</span>
          <Link to="/bets" className="muted" style={{ fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>View all <Icon name="chevron" size={13} style={{ transform: 'rotate(-90deg)' }} /></Link>
        </div>
        {recent.length === 0 ? <p className="muted" style={{ margin: '4px 2px' }}>No bets logged yet.</p> : (
          <div className="act-list">
            {recent.map((b) => {
              const p = betProfit(b);
              const settled = SETTLED.includes(b.status);
              const title = b.event || b.selection || b.sport || 'Bet';
              const sub = b.event ? (b.selection || b.bet_type || b.sport) : (b.bet_type || b.sport || '');
              return (
                <button key={b.id} type="button" className="act-row" onClick={() => setPreview(b)}>
                  <span className="act-ic">{(b.sport || '?').slice(0, 1).toUpperCase()}</span>
                  <span className="act-mid">
                    <span className="act-title">{title}</span>
                    {sub ? <span className="act-sub">{sub}</span> : null}
                  </span>
                  <span className="act-stake">{formatStake(b.stake, currency, staking)}<span className="act-odds">@ {formatOdds(b.odds, settings.oddsFormat)}</span></span>
                  <span className="act-right">
                    <span className={`act-badge ${b.status}`}>{b.status === 'won' ? 'Won' : b.status === 'lost' ? 'Lost' : b.status === 'pending' ? 'Open' : b.status}</span>
                    {settled && (
                      <span className="act-pl">
                        <span className={pcls(p)}>{money(p, currency, { signed: true })}</span>
                        {showUnits && <span className={`act-pl-u ${pcls(p)}`}>{unitsOf(p)}</span>}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Open bets — quick settle */}
      {pending.length > 0 && (
        <div className="card perf-card">
          <div className="perf-card-head static">
            <span className="pch-title"><Icon name="bets" size={17} /> Open bets ({pending.length})</span>
            <span className="muted" style={{ fontSize: 12.5 }}>{formatStake(pending.reduce((s, b) => s + b.stake, 0), currency, staking)} staked</span>
          </div>
          <div className="stack">
            {pending.slice(0, 6).map((b) => (
              <div key={b.id} className="row spread" style={{ flexWrap: 'wrap', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{b.selection || b.event || b.sport || 'Bet'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{formatDate(b.placed_at)} · {formatStake(b.stake, currency, staking)} @ {formatOdds(b.odds, settings.oddsFormat)}</div>
                </div>
                <SettleControls bet={b} onSettle={(status) => settle(b, status)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {preview && (
        <BetPreview
          bet={preview}
          currency={currency}
          staking={staking}
          oddsFormat={settings.oddsFormat || 'decimal'}
          profit={SETTLED.includes(preview.status) ? betProfit(preview) : null}
          onEdit={() => { setPreview(null); navigate('/bets'); }}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
