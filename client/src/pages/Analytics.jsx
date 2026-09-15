import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
} from 'recharts';
import { api } from '../api.js';
import { useSettings } from '../context/SettingsContext.jsx';
import { useTracker } from '../context/TrackerContext.jsx';
import Spinner from '../components/Spinner.jsx';
import Icon from '../components/Icon.jsx';
import { getCached, setCached, subscribeInvalidate } from '../dataCache.js';
import { useAddBet } from '../context/AddBetContext.jsx';
import { money, units, formatStake } from '../format.js';

const BLANK_FILTERS = { from: '', to: '', sport: '', tipster: '' };

const RANGES = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: 'ytd', label: 'This year' },
  { key: 'all', label: 'All time' },
];

// Local YYYY-MM-DD (avoids the UTC shift toISOString would introduce near midnight).
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// The applied from/to filters for a named range preset.
function rangeToFilters(key) {
  const f = { ...BLANK_FILTERS };
  if (key === 'ytd') f.from = `${new Date().getFullYear()}-01-01`;
  else {
    const r = RANGES.find((x) => x.key === key);
    if (r?.days) { const d = new Date(); d.setDate(d.getDate() - (r.days - 1)); f.from = isoLocal(d); }
  }
  return f;
}

function Bars({ rows, currency, staking }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.profit)));
  return (
    <div className="stack" style={{ gap: 12 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div className="row spread" style={{ fontSize: 13.5 }}>
            <span style={{ fontWeight: 600 }}>{r.label} <span className="muted" style={{ fontWeight: 500 }}>· {r.bets} · {r.winRate}% WR</span></span>
            <span className={r.profit > 0 ? 'pos' : r.profit < 0 ? 'neg' : 'muted'} style={{ fontWeight: 700 }}>
              {formatStake(r.profit, currency, staking, { signed: true })} <span className="muted" style={{ fontWeight: 500 }}>({r.roi}%)</span>
            </span>
          </div>
          <div className="bar"><i style={{ width: `${Math.max(4, (Math.abs(r.profit) / max) * 100)}%`, background: r.profit >= 0 ? 'var(--win)' : 'var(--loss)' }} /></div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { settings } = useSettings();
  const { activeId } = useTracker();
  const { openAddBet } = useAddBet();
  // Open on the user's preferred default window (You → App preferences), Pro only.
  const defaultRange = settings?.defaultRange || 'all';
  const [filters, setFilters] = useState(() => rangeToFilters(defaultRange));
  const [range, setRange] = useState(defaultRange);
  const cacheKey = 'analytics:' + activeId + ':' + JSON.stringify(filters);
  const [a, setA] = useState(() => getCached(cacheKey)?.a ?? null);
  const [meta, setMeta] = useState(() => getCached(cacheKey)?.meta ?? { pro: false, options: { sports: [], tipsters: [], bookmakers: [] } });
  const [loading, setLoading] = useState(() => !getCached(cacheKey));
  const [showFilters, setShowFilters] = useState(false);
  const [breakTab, setBreakTab] = useState(null); // null = breakdown collapsed
  const [recentMode, setRecentMode] = useState('7d');

  const currency = settings?.currency || 'GBP';
  const staking = settings?.staking;
  const unitSize = Number(staking?.unitSize) || 0;
  const showUnits = unitSize > 0;
  const unitsFirst = (staking?.mode === 'units') && showUnits;

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (activeId) q.set('tracker', activeId);
    Object.entries(filters).forEach(([k, v]) => { if (v) q.set(k, v); });
    const qs = q.toString();
    const key = 'analytics:' + activeId + ':' + JSON.stringify(filters);
    return api.get('/bets/analytics' + (qs ? `?${qs}` : '')).then((d) => {
      const m = { pro: d.pro, options: d.options };
      setA(d.analytics);
      setMeta(m);
      setCached(key, { a: d.analytics, meta: m });
    });
  }, [filters, activeId]);

  useEffect(() => {
    if (!activeId) return;
    const cached = getCached(cacheKey);
    if (cached) { setA(cached.a); setMeta(cached.meta); }
    load().finally(() => setLoading(false));
  }, [load, activeId, cacheKey]);
  useEffect(() => subscribeInvalidate(() => load()), [load]);

  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const applyRange = (key) => {
    setRange(key);
    const r = rangeToFilters(key);
    setFilters((f) => ({ ...f, from: r.from, to: r.to }));
  };

  if (loading) return <div className="main"><Spinner /></div>;

  const pro = meta.pro;
  const anyFilter = Boolean(filters.sport || filters.tipster);
  const rangeLabel = RANGES.find((r) => r.key === range)?.label || 'All time';

  // ---- Header (range + filters) --------------------------------------------
  const header = (
    <div className="perf-head">
      <h1>Performance</h1>
      <div className="perf-controls">
        {pro ? (
          <label className="range-pill">
            <Icon name="calendar" size={15} />
            <select value={range} onChange={(e) => applyRange(e.target.value)}>
              {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <Icon name="chevron" size={14} />
          </label>
        ) : (
          <Link to="/account" className="range-pill as-link">
            <Icon name="calendar" size={15} />
            <span>All time</span>
            <Icon name="lock" size={14} />
          </Link>
        )}
        {pro ? (
          <button type="button" className={`icon-btn ${showFilters || anyFilter ? 'on' : ''}`} onClick={() => setShowFilters((s) => !s)} aria-label="Filters">
            <Icon name="sliders" size={18} />
          </button>
        ) : (
          <Link to="/account" className="icon-btn" aria-label="Filters"><Icon name="sliders" size={18} /></Link>
        )}
      </div>
    </div>
  );

  const filterPanel = pro && showFilters && (
    <div className="card" style={{ marginBottom: 16, padding: 14 }}>
      <div className="row spread" style={{ marginBottom: 10 }}>
        <h3 className="section-title" style={{ margin: 0 }}>Filter by</h3>
        {anyFilter && <button className="btn-ghost btn-sm" onClick={() => setFilters((f) => ({ ...f, sport: '', tipster: '' }))}>Clear</button>}
      </div>
      <div className="grid-2">
        <div className="field" style={{ margin: 0 }}>
          <label>Sport</label>
          <select value={filters.sport} onChange={(e) => setFilter('sport', e.target.value)}>
            <option value="">All sports</option>
            {meta.options.sports.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Tipster</label>
          <select value={filters.tipster} onChange={(e) => setFilter('tipster', e.target.value)}>
            <option value="">All tipsters</option>
            {meta.options.tipsters.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  const hasData = a && a.overall.bets > 0;
  if (!hasData) {
    return (
      <div className="main">
        {header}
        {filterPanel}
        <div className="card empty">
          <div className="em"><Icon name="analytics" size={40} /></div>
          <h3>{(anyFilter || range !== 'all') ? 'No settled bets in this range' : 'No settled bets yet'}</h3>
          <p>{(anyFilter || range !== 'all') ? 'Nothing matches your current view — widen the range or clear the filters.' : "Once you've settled a few bets, your trends and breakdowns show up here."}</p>
          {(anyFilter || range !== 'all')
            ? <button className="btn-primary" onClick={() => { setFilters(BLANK_FILTERS); setRange('all'); }} style={{ display: 'inline-block', marginTop: 10 }}>Clear filters</button>
            : <button type="button" onClick={() => openAddBet()} className="btn-primary" style={{ display: 'inline-block', marginTop: 10 }}>+ Add a bet</button>}
        </div>
      </div>
    );
  }

  const o = a.overall;
  const pcls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
  const avgStake = o.bets ? o.staked / o.bets : 0;
  const unitsOf = (v) => units(showUnits ? v / unitSize : 0, { signed: true });

  // Hero primary/secondary figures.
  const heroBig = unitsFirst ? unitsOf(o.profit) : money(o.profit, currency, { signed: true });
  const heroSub = unitsFirst ? money(o.profit, currency, { signed: true }) : (showUnits ? unitsOf(o.profit) : null);

  // Cumulative daily trend for the hero sparkline.
  let run = 0;
  const trend = (a.daily || []).map((d) => { run += d.profit; return { date: d.date, cum: Number(run.toFixed(2)) }; });
  const up = o.profit >= 0;

  // Breakdown dimensions (only those with data).
  const breakdowns = [
    a.bySport?.length ? { key: 'sport', label: 'Sport', rows: a.bySport.map((s) => ({ ...s, label: s.sport })) } : null,
    a.byBookmaker?.length ? { key: 'bookmaker', label: 'Bookmaker', rows: a.byBookmaker.map((s) => ({ ...s, label: s.bookmaker })) } : null,
    a.byOddsBand?.length ? { key: 'odds', label: 'Odds', rows: a.byOddsBand.map((x) => ({ ...x, label: x.band })) } : null,
    a.byDay?.some((d) => d.bets > 0) ? { key: 'day', label: 'Day', rows: a.byDay.filter((d) => d.bets > 0).map((d) => ({ ...d, label: d.day })) } : null,
    a.byTipster?.length ? { key: 'tipster', label: 'Tipster', rows: a.byTipster.map((t) => ({ ...t, label: t.tipster })) } : null,
  ].filter(Boolean);
  const activeBreak = breakdowns.find((b) => b.key === breakTab);
  const toggleBreak = () => setBreakTab((t) => (t ? null : (breakdowns[0]?.key || null)));
  const openBreak = (key) => setBreakTab((t) => (t === key ? null : key));

  const bestSport = a.bySport?.find((s) => s.profit > 0) || a.bySport?.[0];
  const bestBook = a.byBookmaker?.find((s) => s.profit > 0) || a.byBookmaker?.[0];

  // Wins/losses bar + units bar fills.
  const decisive = o.wins + o.losses;
  const winFill = decisive ? (o.wins / decisive) * 100 : 0;
  const unitFill = Math.max(6, Math.min(100, 50 + o.roi)); // profit tips it past the midpoint

  // ---- Recent performance squares ------------------------------------------
  const dailyMap = new Map((a.daily || []).map((d) => [d.date, d]));
  let squares;
  if (recentMode === 'all') {
    squares = (a.daily || []).map((d) => ({ key: d.date, entry: d, label: '' }));
  } else {
    const n = recentMode === '7d' ? 7 : 30;
    squares = [];
    const today = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = isoLocal(d);
      squares.push({ key, entry: dailyMap.get(key), label: n === 7 ? d.toLocaleDateString(undefined, { weekday: 'short' }) : '' });
    }
  }
  const sqClass = (entry) => {
    if (!entry || !entry.bets) return 'sq';
    if (entry.profit > 0) return 'sq win';
    if (entry.profit < 0) return 'sq loss';
    return 'sq flat';
  };

  return (
    <div className="main">
      {header}
      {filterPanel}

      {/* Net profit hero + headline rates. */}
      <div className="card perf-hero">
        <div className="ph-top">
          <div className="ph-figures">
            <span className="ph-label">Net profit</span>
            <span className={`ph-big ${pcls(o.profit)}`}>{heroBig}</span>
            {heroSub && <span className={`ph-sub ${pcls(o.profit)}`}>{heroSub}</span>}
          </div>
          {trend.length >= 2 && (
            <div className="ph-chart">
              <ResponsiveContainer width="100%" height={92}>
                <AreaChart data={trend} margin={{ top: 6, right: 2, bottom: 0, left: 2 }}>
                  <defs>
                    <linearGradient id="phFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={up ? 'var(--win)' : 'var(--loss)'} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={up ? 'var(--win)' : 'var(--loss)'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 12 }}
                    labelFormatter={() => ''}
                    formatter={(v) => [money(v, currency, { signed: true }), 'Balance']}
                  />
                  <Area type="monotone" dataKey="cum" stroke={up ? 'var(--win)' : 'var(--loss)'} strokeWidth={2.5} fill="url(#phFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="ph-stats">
          <div><span className="k">ROI</span><span className={`v ${pcls(o.roi)}`}>{o.roi}%</span></div>
          <div><span className="k">Win rate</span><span className="v">{o.winRate}%</span></div>
          <div><span className="k">Avg stake</span><span className="v">{formatStake(avgStake, currency, staking)}</span></div>
          <div><span className="k">Total bets</span><span className="v">{o.bets}</span></div>
        </div>
      </div>

      {/* Performance breakdown + trends. */}
      <div className="card perf-card">
        <button type="button" className="perf-card-head" onClick={toggleBreak}>
          <span className="pch-title"><Icon name="analytics" size={18} /> Performance breakdown</span>
          <Icon name="chevron" size={16} className={breakTab ? 'flip' : ''} />
        </button>

        <div className="brk-row">
          <span className="brk-ic"><Icon name="trophy" size={17} /></span>
          <div className="brk-mid">
            <div className="brk-label">Wins vs Losses</div>
            <div className="bar"><i style={{ width: `${Math.max(4, winFill)}%`, background: 'var(--win)' }} /></div>
          </div>
          <div className="brk-val">
            <span className="v">{o.wins}W / {o.losses}L</span>
            <span className="s">{o.winRate}% win rate</span>
          </div>
        </div>

        {showUnits && (
          <div className="brk-row">
            <span className="brk-ic u">u</span>
            <div className="brk-mid">
              <div className="brk-label">Units</div>
              <div className="bar"><i style={{ width: `${unitFill}%`, background: up ? 'var(--win)' : 'var(--loss)' }} /></div>
            </div>
            <div className="brk-val">
              <span className={`v ${pcls(o.profit)}`}>{unitsOf(o.profit)}</span>
              <span className="s">Net units</span>
            </div>
          </div>
        )}

        {bestSport && (
          <button type="button" className="brk-row tap" onClick={() => openBreak('sport')}>
            <span className="brk-ic"><Icon name="ball" size={17} /></span>
            <div className="brk-mid">
              <div className="brk-top">
                <span className="brk-label">Profit by Sport</span>
                <span className={`brk-amt ${pcls(o.profit)}`}>{formatStake(o.profit, currency, staking, { signed: true })} <Icon name="chevron" size={13} className="rt" /></span>
              </div>
              <div className="brk-sub">Best: {bestSport.sport} ({formatStake(bestSport.profit, currency, staking, { signed: true })})</div>
            </div>
          </button>
        )}

        {bestBook && (
          <button type="button" className="brk-row tap" onClick={() => openBreak('bookmaker')}>
            <span className="brk-ic"><Icon name="bank" size={17} /></span>
            <div className="brk-mid">
              <div className="brk-top">
                <span className="brk-label">Profit by Bookmaker</span>
                <span className={`brk-amt ${pcls(o.profit)}`}>{formatStake(o.profit, currency, staking, { signed: true })} <Icon name="chevron" size={13} className="rt" /></span>
              </div>
              <div className="brk-sub">Best: {bestBook.bookmaker} ({formatStake(bestBook.profit, currency, staking, { signed: true })})</div>
            </div>
          </button>
        )}

        {activeBreak && (
          <div className="brk-detail">
            {breakdowns.length > 1 && (
              <div className="seg-group" style={{ marginBottom: 14 }}>
                {breakdowns.map((b) => (
                  <button key={b.key} type="button" className={activeBreak.key === b.key ? 'seg on' : 'seg'} onClick={() => setBreakTab(b.key)}>{b.label}</button>
                ))}
              </div>
            )}
            <Bars rows={activeBreak.rows} currency={currency} staking={staking} />
          </div>
        )}
      </div>

      {/* Betting trends. */}
      <div className="card perf-card">
        <div className="perf-card-head static">
          <span className="pch-title"><Icon name="trend" size={18} /> Betting trends</span>
        </div>
        <div className="trend-split">
          <div className="trend-box">
            <div className="tb-head"><Icon name="link" size={15} /> Streaks</div>
            <div className="tb-pair">
              <div><span className="k">Best streak</span><span className="v pos">{a.streaks.longestWin}W</span></div>
              <div><span className="k">Worst streak</span><span className="v neg">{a.streaks.longestLoss}L</span></div>
            </div>
          </div>
          <div className="trend-box">
            <div className="tb-head"><Icon name="trophy" size={15} /> Biggest moves</div>
            <div className="tb-pair">
              <div><span className="k">Biggest win</span><span className="v pos">{money(a.biggestWin, currency, { signed: true })}</span></div>
              <div><span className="k">Biggest loss</span><span className="v neg">{money(a.biggestLoss, currency, { signed: true })}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent performance. */}
      <div className="card perf-card">
        <div className="perf-card-head static">
          <span className="pch-title"><Icon name="calendar" size={17} /> Recent performance</span>
          <div className="seg-mini">
            {['7d', '30d', 'all'].map((m) => (
              <button key={m} type="button" className={recentMode === m ? 'on' : ''} onClick={() => setRecentMode(m)}>{m === 'all' ? 'ALL' : m.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div className={`sq-grid ${recentMode === '7d' ? 'week' : ''}`}>
          {squares.length === 0 && <span className="muted" style={{ fontSize: 13 }}>No activity yet.</span>}
          {squares.map((s) => (
            <div key={s.key} className="sq-cell">
              <div className={sqClass(s.entry)} title={s.entry ? `${s.key}: ${money(s.entry.profit, currency, { signed: true })}` : s.key} />
              {s.label && <span className="sq-lab">{s.label}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
