import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useSettings } from '../context/SettingsContext.jsx';
import StatCard from '../components/StatCard.jsx';
import ProfitChart from '../components/ProfitChart.jsx';
import { money, formatDate } from '../format.js';

export default function Dashboard() {
  const { settings } = useSettings();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    api.get('/bets/stats').then((d) => setStats(d.stats));
    api.get('/bets').then((d) => setRecent(d.bets.slice(0, 8)));
  }, []);

  if (!settings || !stats) return <div className="main"><p className="muted">Loading…</p></div>;

  const currency = settings.currency;
  const enabledCards = settings.statCards.filter((c) => c.enabled);
  const w = settings.widgets;

  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Here's how you're getting on.</p>
        </div>
        <Link to="/bets" className="btn-primary" style={{ display: 'inline-block' }}>+ Add bet</Link>
      </div>

      {enabledCards.length === 0 ? (
        <div className="card empty">No stat cards enabled — turn some on in Customise.</div>
      ) : (
        <div className="stat-grid">
          {enabledCards.map((c) => (
            <StatCard key={c.key} statKey={c.key} stats={stats} currency={currency} />
          ))}
        </div>
      )}

      {w.profitChart && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="section-title">Profit over time</h3>
          <ProfitChart timeline={stats.timeline} primary={settings.theme.primary} />
        </div>
      )}

      <div className="grid-2">
        {w.sportBreakdown && (
          <div className="card">
            <h3 className="section-title">By sport / category</h3>
            {stats.sportBreakdown.length === 0 ? (
              <p className="muted">No settled bets yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Category</th><th>Bets</th><th>ROI</th><th>Profit</th></tr>
                  </thead>
                  <tbody>
                    {stats.sportBreakdown.map((s) => (
                      <tr key={s.sport}>
                        <td>{s.sport}</td>
                        <td>{s.bets}</td>
                        <td className={s.roi > 0 ? 'pos' : s.roi < 0 ? 'neg' : ''}>{s.roi}%</td>
                        <td className={s.profit > 0 ? 'pos' : s.profit < 0 ? 'neg' : ''}>
                          {money(s.profit, currency, { signed: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {w.recentBets && (
          <div className="card">
            <div className="row spread" style={{ marginBottom: 14 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Recent bets</h3>
              <Link to="/bets" className="muted" style={{ fontSize: 13 }}>View all →</Link>
            </div>
            {recent.length === 0 ? (
              <p className="muted">No bets logged yet.</p>
            ) : (
              <div className="stack">
                {recent.map((b) => (
                  <div key={b.id} className="row spread" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{b.selection || b.event || b.sport || 'Bet'}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{formatDate(b.placed_at)} · {b.sport || 'Uncategorised'}</div>
                    </div>
                    <span className={`badge ${b.status}`}>{b.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
