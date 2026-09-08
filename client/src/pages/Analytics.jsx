import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell,
} from 'recharts';
import { api } from '../api.js';
import { useSettings } from '../context/SettingsContext.jsx';
import Spinner from '../components/Spinner.jsx';
import Icon from '../components/Icon.jsx';
import { formatStake } from '../format.js';

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

export default function Analytics() {
  const { settings } = useSettings();
  const [a, setA] = useState(null);
  const [meta, setMeta] = useState({ pro: false, options: { sports: [], tipsters: [], bookmakers: [] } });
  const [filters, setFilters] = useState(BLANK_FILTERS);
  const [loading, setLoading] = useState(true);
  const currency = settings?.currency || 'GBP';
  const staking = settings?.staking;

  const load = useCallback(() => {
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) q.set(k, v); });
    const qs = q.toString();
    return api.get('/bets/analytics' + (qs ? `?${qs}` : '')).then((d) => {
      setA(d.analytics);
      setMeta({ pro: d.pro, options: d.options });
    });
  }, [filters]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

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
        <div className="page-head"><div><h1>Analytics</h1><p>Insights from your betting.</p></div></div>
        {controls}
        <div className="card empty">
          <div className="em"><Icon name="analytics" size={40} /></div>
          <h3>{anyFilter ? 'No bets in this view' : 'No settled bets yet'}</h3>
          <p>{anyFilter ? 'Try widening your filters.' : "Once you've settled a few bets, your trends and breakdowns show up here."}</p>
          {anyFilter
            ? <button className="btn-ghost" onClick={() => setFilters(BLANK_FILTERS)} style={{ marginTop: 10 }}>Clear filters</button>
            : <Link to="/bets?new=1" className="btn-primary" style={{ display: 'inline-block', marginTop: 10 }}>+ Add a bet</Link>}
        </div>
      </div>
    );
  }

  const monthly = a.monthly.map((m) => ({ ...m, name: m.label }));
  const st = a.streaks;

  return (
    <div className="main">
      <div className="page-head"><div><h1>Analytics</h1><p>Insights from your betting.</p></div></div>
      {controls}

      {/* Headline numbers */}
      <div className="stat-grid">
        <div className="stat"><div className="label">Net Profit</div><div className={`value ${a.overall.profit > 0 ? 'pos' : a.overall.profit < 0 ? 'neg' : ''}`}>{formatStake(a.overall.profit, currency, staking, { signed: true })}</div></div>
        <div className="stat"><div className="label">ROI</div><div className={`value ${a.overall.roi > 0 ? 'pos' : a.overall.roi < 0 ? 'neg' : ''}`}>{a.overall.roi}%</div></div>
        <div className="stat"><div className="label">Win Rate</div><div className="value">{a.overall.winRate}%</div></div>
        <div className="stat"><div className="label">Best Streak</div><div className="value pos">{st.longestWin}W</div><div className="sub">worst {st.longestLoss}L</div></div>
        <div className="stat"><div className="label">Biggest Win</div><div className="value pos">{formatStake(a.biggestWin, currency, staking, { signed: true })}</div></div>
        <div className="stat"><div className="label">Biggest Loss</div><div className="value neg">{formatStake(a.biggestLoss, currency, staking, { signed: true })}</div></div>
      </div>

      {/* Monthly P/L */}
      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">Monthly profit / loss</h3>
        <ResponsiveContainer width="100%" height={260}>
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

      <div className="grid-2">
        {/* By odds band */}
        <div className="card">
          <h3 className="section-title">By odds range</h3>
          <Bars rows={a.byOddsBand.map((o) => ({ ...o, label: o.band }))} currency={currency} staking={staking} />
        </div>
        {/* By bookmaker */}
        <div className="card">
          <h3 className="section-title">By bookmaker</h3>
          <Bars rows={a.byBookmaker.map((b) => ({ ...b, label: b.bookmaker }))} currency={currency} staking={staking} />
        </div>
      </div>

      {/* By tipster — only when some bets name a tipster */}
      {a.byTipster && a.byTipster.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3 className="section-title">By tipster</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>How the tipsters you follow are actually performing.</p>
          <Bars rows={a.byTipster.map((t) => ({ ...t, label: t.tipster }))} currency={currency} staking={staking} />
        </div>
      )}

      {/* Day of week */}
      <div className="card" style={{ marginTop: 18 }}>
        <h3 className="section-title">By day of week</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Day</th><th>Bets</th><th>Win rate</th><th>ROI</th><th>Profit</th></tr></thead>
            <tbody>
              {a.byDay.filter((d) => d.bets > 0).map((d) => (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  <td>{d.bets}</td>
                  <td>{d.winRate}%</td>
                  <td className={d.roi > 0 ? 'pos' : d.roi < 0 ? 'neg' : ''}>{d.roi}%</td>
                  <td className={d.profit > 0 ? 'pos' : d.profit < 0 ? 'neg' : 'muted'}>{formatStake(d.profit, currency, staking, { signed: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
