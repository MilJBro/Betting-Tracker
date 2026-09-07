import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { applyTheme } from '../context/SettingsContext.jsx';
import ProfitChart from '../components/ProfitChart.jsx';
import Icon from '../components/Icon.jsx';
import { formatStake, formatOdds, formatDate } from '../format.js';

export default function Share() {
  const { publicId } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/share/public/${publicId}`)
      .then((d) => {
        setProfile(d.profile);
        applyTheme(d.profile.theme);
      })
      .catch((e) => setError(e.message));
  }, [publicId]);

  if (error) {
    return (
      <div className="auth-wrap">
        <div className="card empty" style={{ maxWidth: 420 }}>
          <div className="em"><Icon name="lock" size={38} /></div>
          <h3>Not available</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  if (!profile) return <div className="main"><p className="muted">Loading…</p></div>;

  const { stats, currency, reveal } = profile;
  const staking = profile.staking;

  return (
    <div className="main" style={{ maxWidth: 900 }}>
      <div className="page-head">
        <div>
          <h1>{profile.displayName}</h1>
          <p>Betting performance · shared publicly</p>
        </div>
        <a href="/" className="btn-ghost" style={{ display: 'inline-block' }}>Track your own →</a>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="label">Total Bets</div>
          <div className="value">{stats.totalBets}</div>
        </div>
        {reveal.winRate && (
          <div className="stat">
            <div className="label">Win Rate</div>
            <div className="value">{stats.winRate}%</div>
          </div>
        )}
        {reveal.roi && (
          <div className="stat">
            <div className="label">ROI</div>
            <div className={`value ${stats.roi > 0 ? 'pos' : stats.roi < 0 ? 'neg' : ''}`}>{stats.roi}%</div>
          </div>
        )}
        {reveal.profit && (
          <div className="stat">
            <div className="label">Net Profit</div>
            <div className={`value ${stats.netProfit > 0 ? 'pos' : stats.netProfit < 0 ? 'neg' : ''}`}>
              {formatStake(stats.netProfit, currency, staking, { signed: true })}
            </div>
          </div>
        )}
        {reveal.stakes && stats.totalStaked != null && (
          <div className="stat">
            <div className="label">Total Staked</div>
            <div className="value">{formatStake(stats.totalStaked, currency, staking)}</div>
          </div>
        )}
      </div>

      {reveal.profit && stats.timeline.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="section-title">Profit over time</h3>
          <ProfitChart timeline={stats.timeline} primary={profile.theme.primary} />
        </div>
      )}

      {stats.sportBreakdown.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="section-title">By sport / category</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Category</th><th>Bets</th>{reveal.roi && <th>ROI</th>}{reveal.profit && <th>Profit</th>}</tr>
              </thead>
              <tbody>
                {stats.sportBreakdown.map((s) => (
                  <tr key={s.sport}>
                    <td>{s.sport}</td>
                    <td>{s.bets}</td>
                    {reveal.roi && <td className={s.roi > 0 ? 'pos' : s.roi < 0 ? 'neg' : ''}>{s.roi}%</td>}
                    {reveal.profit && (
                      <td className={s.profit > 0 ? 'pos' : s.profit < 0 ? 'neg' : ''}>
                        {formatStake(s.profit, currency, staking, { signed: true })}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {profile.recent.length > 0 && (
        <div className="card">
          <h3 className="section-title">Recent bets</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Sport</th><th>Selection</th><th>Odds</th>{reveal.stakes && <th>Stake</th>}<th>Result</th></tr>
              </thead>
              <tbody>
                {profile.recent.map((b, i) => (
                  <tr key={i}>
                    <td>{formatDate(b.placed_at)}</td>
                    <td>{b.sport || '—'}</td>
                    <td>{b.selection || '—'}</td>
                    <td>{formatOdds(b.odds)}</td>
                    {reveal.stakes && <td>{b.stake != null ? formatStake(b.stake, currency, staking) : '—'}</td>}
                    <td><span className={`badge ${b.status}`}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 30 }}>
        Powered by Betfolio
      </p>
    </div>
  );
}
