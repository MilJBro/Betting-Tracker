import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useSettings } from '../context/SettingsContext.jsx';
import StatCard from '../components/StatCard.jsx';
import ProfitChart from '../components/ProfitChart.jsx';
import Spinner from '../components/Spinner.jsx';
import { money, formatDate } from '../format.js';

export default function Dashboard() {
  const { settings } = useSettings();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/bets/stats').then((d) => setStats(d.stats)),
      api.get('/bets').then((d) => setRecent(d.bets.slice(0, 8))),
    ]).finally(() => setLoading(false));
  }, []);

  if (!settings || loading || !stats) return <div className="main"><Spinner /></div>;

  const currency = settings.currency;
  const enabledCards = settings.statCards.filter((c) => c.enabled);
  const w = settings.widgets;

  // First-run onboarding: guide brand-new accounts before there's any data.
  if (stats.totalBets === 0) {
    return (
      <div className="main">
        <div className="page-head">
          <div>
            <h1>Welcome{settings.sharing?.displayName ? `, ${settings.sharing.displayName}` : ''} 👋</h1>
            <p>Let's get your tracker set up.</p>
          </div>
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title">Getting started</h3>
          <div className="stack" style={{ gap: 14 }}>
            <div className="row spread" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div><strong>1. Log your first bet</strong><div className="muted" style={{ fontSize: 13 }}>Record the stake, odds and result — profit and ROI are worked out for you.</div></div>
              <Link to="/bets?new=1" className="btn-primary" style={{ display: 'inline-block' }}>+ Add a bet</Link>
            </div>
            <div className="row spread" style={{ flexWrap: 'wrap', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div><strong>2. Make it yours</strong><div className="muted" style={{ fontSize: 13 }}>Pick your colour, currency, odds format, and what to track.</div></div>
              <Link to="/customise" className="btn-ghost" style={{ display: 'inline-block' }}>Customise</Link>
            </div>
            <div className="row spread" style={{ flexWrap: 'wrap', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div><strong>3. Share your form</strong><div className="muted" style={{ fontSize: 13 }}>When you're ready, publish a read-only page of how you're doing.</div></div>
              <Link to="/customise" className="btn-ghost" style={{ display: 'inline-block' }}>Set up sharing</Link>
            </div>
          </div>
        </div>
        <p className="muted" style={{ textAlign: 'center', fontSize: 12 }}>Please gamble responsibly. You must be 18+ to bet.</p>
      </div>
    );
  }

  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Here's how you're getting on.</p>
        </div>
        <Link to="/bets?new=1" className="btn-primary" style={{ display: 'inline-block' }}>+ Add bet</Link>
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
