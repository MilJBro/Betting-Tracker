import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell,
} from 'recharts';
import { api } from '../api.js';
import { useSettings } from '../context/SettingsContext.jsx';
import Spinner from '../components/Spinner.jsx';
import { money } from '../format.js';

function Bars({ rows, currency }) {
  // Horizontal profit bars for a labelled breakdown (bookmaker, odds band…).
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.profit)));
  return (
    <div className="stack" style={{ gap: 12 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div className="row spread" style={{ fontSize: 13.5 }}>
            <span style={{ fontWeight: 600 }}>{r.label} <span className="muted" style={{ fontWeight: 500 }}>· {r.bets} · {r.winRate}% WR</span></span>
            <span className={r.profit > 0 ? 'pos' : r.profit < 0 ? 'neg' : 'muted'} style={{ fontWeight: 700 }}>
              {money(r.profit, currency, { signed: true })} <span className="muted" style={{ fontWeight: 500 }}>({r.roi}%)</span>
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
  const [a, setA] = useState(null);
  const [loading, setLoading] = useState(true);
  const currency = settings?.currency || 'GBP';

  useEffect(() => {
    api.get('/bets/analytics').then((d) => setA(d.analytics)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="main"><Spinner /></div>;

  const hasData = a && a.overall.bets > 0;
  if (!hasData) {
    return (
      <div className="main">
        <div className="page-head"><div><h1>Analytics</h1><p>Insights from your betting.</p></div></div>
        <div className="card empty">
          <div className="em">📈</div>
          <h3>No settled bets yet</h3>
          <p>Once you've settled a few bets, your trends and breakdowns show up here.</p>
          <Link to="/bets?new=1" className="btn-primary" style={{ display: 'inline-block', marginTop: 10 }}>+ Add a bet</Link>
        </div>
      </div>
    );
  }

  const monthly = a.monthly.map((m) => ({ ...m, name: m.label }));
  const st = a.streaks;

  return (
    <div className="main">
      <div className="page-head"><div><h1>Analytics</h1><p>Insights from your betting.</p></div></div>

      {/* Headline numbers */}
      <div className="stat-grid">
        <div className="stat"><div className="label">Net Profit</div><div className={`value ${a.overall.profit > 0 ? 'pos' : a.overall.profit < 0 ? 'neg' : ''}`}>{money(a.overall.profit, currency, { signed: true })}</div></div>
        <div className="stat"><div className="label">ROI</div><div className={`value ${a.overall.roi > 0 ? 'pos' : a.overall.roi < 0 ? 'neg' : ''}`}>{a.overall.roi}%</div></div>
        <div className="stat"><div className="label">Win Rate</div><div className="value">{a.overall.winRate}%</div></div>
        <div className="stat"><div className="label">Best Streak</div><div className="value pos">{st.longestWin}W</div><div className="sub">worst {st.longestLoss}L</div></div>
        <div className="stat"><div className="label">Biggest Win</div><div className="value pos">{money(a.biggestWin, currency, { signed: true })}</div></div>
        <div className="stat"><div className="label">Biggest Loss</div><div className="value neg">{money(a.biggestLoss, currency, { signed: true })}</div></div>
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
              formatter={(v) => [money(v, currency, { signed: true }), 'Profit']}
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
          <Bars rows={a.byOddsBand.map((o) => ({ ...o, label: o.band }))} currency={currency} />
        </div>
        {/* By bookmaker */}
        <div className="card">
          <h3 className="section-title">By bookmaker</h3>
          <Bars rows={a.byBookmaker.map((b) => ({ ...b, label: b.bookmaker }))} currency={currency} />
        </div>
      </div>

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
                  <td className={d.profit > 0 ? 'pos' : d.profit < 0 ? 'neg' : 'muted'}>{money(d.profit, currency, { signed: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
