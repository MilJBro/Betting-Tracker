import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell,
} from 'recharts';
import { api } from '../api.js';
import { useSettings } from '../context/SettingsContext.jsx';
import { useTracker } from '../context/TrackerContext.jsx';
import Spinner from '../components/Spinner.jsx';
import Icon from '../components/Icon.jsx';
import { getCached, setCached, subscribeInvalidate } from '../dataCache.js';
import { useAddBet } from '../context/AddBetContext.jsx';
import { formatStake, units } from '../format.js';

function Bars({ rows, currency, staking }) {
  // Horizontal profit bars for a labelled breakdown (bookmaker, odds band…).
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

const BLANK_FILTERS = { from: '', to: '', sport: '', tipster: '' };

// Turn the breakdowns into a few plain-English "here's your edge" lines.
function buildHighlights(a, fmt) {
  const out = [];
  const sports = (a.bySport || []).filter((s) => s.bets > 0);
  if (sports.length) {
    const best = sports[0]; // already profit-sorted, desc
    if (best.profit > 0) out.push({ text: `Most profitable sport: ${best.sport}`, value: `${fmt(best.profit)} · ${best.roi}% ROI`, tone: 'pos' });
    const worst = sports[sports.length - 1];
    if (worst.profit < 0 && worst.sport !== best.sport && worst.bets >= 2) out.push({ text: `Toughest sport: ${worst.sport}`, value: `${fmt(worst.profit)} · ${worst.roi}% ROI`, tone: 'neg' });
  }
  const days = (a.byDay || []).filter((d) => d.bets >= 2).slice().sort((x, y) => y.profit - x.profit);
  if (days.length && days[0].profit > 0) out.push({ text: `Your best day is ${days[0].day}`, value: fmt(days[0].profit), tone: 'pos' });
  const bands = (a.byOddsBand || []).filter((o) => o.bets >= 2).slice().sort((x, y) => y.profit - x.profit);
  if (bands.length && bands[0].profit > 0) out.push({ text: `Best odds range: ${bands[0].band}`, value: fmt(bands[0].profit), tone: 'pos' });
  const books = (a.byBookmaker || []).filter((b) => b.bets >= 2);
  if (books.length > 1 && books[0].profit > 0) out.push({ text: `Best with ${books[0].bookmaker}`, value: fmt(books[0].profit), tone: 'pos' });
  return out.slice(0, 4);
}

export default function Analytics() {
  const { settings } = useSettings();
  const { activeId } = useTracker();
  const { openAddBet } = useAddBet();
  const [filters, setFilters] = useState(BLANK_FILTERS);
  const cacheKey = 'analytics:' + activeId + ':' + JSON.stringify(filters);
  const [a, setA] = useState(() => getCached(cacheKey)?.a ?? null);
  const [meta, setMeta] = useState(() => getCached(cacheKey)?.meta ?? { pro: false, options: { sports: [], tipsters: [], bookmakers: [] } });
  const [loading, setLoading] = useState(() => !getCached(cacheKey));
  const [tab, setTab] = useState('sport'); // active breakdown tab
  const currency = settings?.currency || 'GBP';
  const staking = settings?.staking;
  const unitSize = Number(staking?.unitSize) || 0;

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (activeId) q.set('tracker', activeId);
    Object.entries(filters).forEach(([k, v]) => { if (v) q.set(k, v); });
    const qs = q.toString();
    const key = 'analytics:' + activeId + ':' + JSON.stringify(filters);
    return api.get('/bets/analytics' + (qs ? `?${qs}` : '')).then((d) => {
      const meta = { pro: d.pro, options: d.options };
      setA(d.analytics);
      setMeta(meta);
      setCached(key, { a: d.analytics, meta });
    });
  }, [filters, activeId]);

  useEffect(() => {
    if (!activeId) return;
    const cached = getCached(cacheKey);
    if (cached) { setA(cached.a); setMeta(cached.meta); setLoading(false); }
    else setLoading(true);
    load().finally(() => setLoading(false));
  }, [load, activeId, cacheKey]);
  // Refresh when a bet is added from the global Add-bet overlay.
  useEffect(() => subscribeInvalidate(() => load()), [load]);

  if (loading) return <div className="main"><Spinner /></div>;

  const anyFilter = Object.values(filters).some(Boolean);
  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  // Pro-only filter bar; free users see an upgrade teaser instead.
  const controls = meta.pro ? (
    <div className="card" style={{ marginBottom: 16, padding: 14 }}>
      <div className="row spread" style={{ marginBottom: 10 }}>
        <h3 className="section-title" style={{ margin: 0 }}>Filters</h3>
        {anyFilter && <button className="btn-ghost btn-sm" onClick={() => setFilters(BLANK_FILTERS)}>Clear</button>}
      </div>
      <div className="grid-2">
        <div className="field" style={{ margin: 0 }}><label>From date</label><input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} /></div>
        <div className="field" style={{ margin: 0 }}><label>To date</label><input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} /></div>
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
  ) : (
    <Link to="/account" className="card" style={{ marginBottom: 16, display: 'block', textDecoration: 'none', color: 'inherit', borderColor: 'var(--primary)' }}>
      <div className="row spread" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Filter by date, sport & tipster <span className="badge" style={{ textTransform: 'none' }}>Pro</span></div>
          <div className="muted" style={{ fontSize: 13 }}>Zoom into any period or pick apart a single tipster or sport. Upgrade to unlock.</div>
        </div>
        <span className="btn-primary btn-sm" style={{ pointerEvents: 'none' }}>Upgrade</span>
      </div>
    </Link>
  );

  const hasData = a && a.overall.bets > 0;
  if (!hasData) {
    return (
      <div className="main">
        <div className="page-head"><div><h1>Stats</h1></div></div>
        {controls}
        <div className="card empty">
          <div className="em"><Icon name="analytics" size={40} /></div>
          <h3>{anyFilter ? 'No bets in this view' : 'No settled bets yet'}</h3>
          <p>{anyFilter ? 'Try widening your filters.' : "Once you've settled a few bets, your trends and breakdowns show up here."}</p>
          {anyFilter
            ? <button className="btn-ghost" onClick={() => setFilters(BLANK_FILTERS)} style={{ marginTop: 10 }}>Clear filters</button>
            : <button type="button" onClick={() => openAddBet()} className="btn-primary" style={{ display: 'inline-block', marginTop: 10 }}>+ Add a bet</button>}
        </div>
      </div>
    );
  }

  const monthly = a.monthly.map((m) => ({ ...m, name: m.label }));
  const st = a.streaks;
  const highlights = a.overall.bets >= 3
    ? buildHighlights(a, (v) => formatStake(v, currency, staking, { signed: true }))
    : [];

  const o = a.overall;
  const avgStake = o.bets ? o.staked / o.bets : 0;
  const pcls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

  // Breakdowns shown in one tabbed card — only those with data.
  const breakdowns = [
    a.bySport?.length ? { key: 'sport', label: 'Sport', rows: a.bySport.map((s) => ({ ...s, label: s.sport })) } : null,
    a.byOddsBand?.length ? { key: 'odds', label: 'Odds', rows: a.byOddsBand.map((x) => ({ ...x, label: x.band })) } : null,
    a.byDay?.some((d) => d.bets > 0) ? { key: 'day', label: 'Day', rows: a.byDay.filter((d) => d.bets > 0).map((d) => ({ ...d, label: d.day })) } : null,
    a.byTipster?.length ? { key: 'tipster', label: 'Tipster', rows: a.byTipster.map((t) => ({ ...t, label: t.tipster })) } : null,
  ].filter(Boolean);
  const activeBreak = breakdowns.find((b) => b.key === tab) || breakdowns[0];

  return (
    <div className="main">
      <div className="page-head"><div><h1>Stats</h1></div></div>
      {controls}

      {/* Summary hero — net profit (money + units) and the headline rates. */}
      <div className="card bets-summary">
        <div className="bs-hero">
          <span className="bs-label">Net profit</span>
          <span className="bs-figures">
            <span className={`bs-profit ${pcls(o.profit)}`}>{formatStake(o.profit, currency, staking, { signed: true })}</span>
            {unitSize > 0 && (staking?.mode || 'currency') === 'currency' && (
              <span className={`bs-units ${pcls(o.profit)}`}>{units(o.profit / unitSize, { signed: true })}</span>
            )}
          </span>
        </div>
        <div className="bs-stats">
          <div><span className="bs-k">ROI</span><span className={`bs-v ${pcls(o.roi)}`}>{o.roi}%</span></div>
          <div><span className="bs-k">Win rate</span><span className="bs-v">{o.winRate}%</span></div>
          <div><span className="bs-k">Staked</span><span className="bs-v">{formatStake(o.staked, currency, staking)}</span></div>
          <div><span className="bs-k">Bets</span><span className="bs-v">{o.bets}</span></div>
        </div>
      </div>

      {/* Compact key facts. */}
      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat"><div className="label">Best streak</div><div className="value pos">{st.longestWin}W</div><div className="sub">worst {st.longestLoss}L</div></div>
        <div className="stat"><div className="label">Avg stake</div><div className="value">{formatStake(avgStake, currency, staking)}</div></div>
        <div className="stat"><div className="label">Biggest win</div><div className="value pos">{formatStake(a.biggestWin, currency, staking, { signed: true })}</div></div>
        <div className="stat"><div className="label">Biggest loss</div><div className="value neg">{formatStake(a.biggestLoss, currency, staking, { signed: true })}</div></div>
      </div>

      {/* Monthly P/L chart. */}
      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">Monthly profit / loss</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={monthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--muted)" fontSize={11} tickLine={false} />
            <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} width={48} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }}
              formatter={(v) => [formatStake(v, currency, staking, { signed: true }), 'Profit']}
              cursor={{ fill: 'var(--surface-2)' }}
            />
            <ReferenceLine y={0} stroke="var(--muted)" />
            <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
              {monthly.map((m, i) => (
                <Cell key={i} fill={m.profit >= 0 ? 'var(--win)' : 'var(--loss)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Where your edge is — auto-surfaced findings. */}
      {highlights.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 className="section-title">Where your edge is</h3>
          <div className="stack" style={{ gap: 10 }}>
            {highlights.map((h, i) => (
              <div key={i} className="row spread" style={{ fontSize: 14, borderBottom: i < highlights.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: i < highlights.length - 1 ? 10 : 0 }}>
                <span>{h.text}</span>
                <span className={h.tone} style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{h.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdowns — one card, switchable by tab. */}
      {activeBreak && (
        <div className="card">
          <h3 className="section-title">Breakdown</h3>
          {breakdowns.length > 1 && (
            <div className="seg-group" style={{ marginBottom: 16 }}>
              {breakdowns.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  className={activeBreak.key === b.key ? 'seg on' : 'seg'}
                  onClick={() => setTab(b.key)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          )}
          <Bars rows={activeBreak.rows} currency={currency} staking={staking} />
        </div>
      )}
    </div>
  );
}
