import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useSettings } from '../context/SettingsContext.jsx';
import { useTracker } from '../context/TrackerContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import StatCard from '../components/StatCard.jsx';
import ProfitChart from '../components/ProfitChart.jsx';
import SettleControls from '../components/SettleControls.jsx';
import Spinner from '../components/Spinner.jsx';
import { settlePayout } from '../settle.js';
import { formatStake, formatOdds, formatDate } from '../format.js';

export default function Dashboard() {
  const { settings } = useSettings();
  const { active, activeId } = useTracker();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const q = activeId ? `?tracker=${activeId}` : '';
    return Promise.all([
      api.get('/bets/stats' + q).then((d) => setStats(d.stats)),
      api.get('/bets' + q).then((d) => setBets(d.bets)),
    ]);
  }, [activeId]);
  useEffect(() => { if (!activeId) return; setLoading(true); load().finally(() => setLoading(false)); }, [activeId, load]);

  async function settle(bet, status) {
    try {
      await api.put(`/bets/${bet.id}`, { ...bet, status, payout: settlePayout(bet, status) });
      await load();
      const label = { won: 'won', lost: 'lost', placed: 'placed', void: 'void' }[status] || status;
      toast(`Marked ${label}`);
    } catch (e) { toast(e.message, 'error'); }
  }

  if (!settings || loading || !stats) return <div className="main"><Spinner /></div>;

  const currency = settings.currency;
  const staking = settings.staking;
  const enabledCards = settings.statCards.filter((c) => c.enabled);
  const w = settings.widgets;
  const recent = bets.slice(0, 8);
  const pending = bets.filter((b) => b.status === 'pending');
  const pendingStaked = pending.reduce((s, b) => s + b.stake, 0);
  const pendingReturn = pending.reduce((s, b) => s + b.stake * b.odds, 0);

  // Bankroll: current balance is the tracker's starting bankroll plus realised profit.
  const bankrollStart = Number(active?.bankroll_start) || 0;
  const balance = bankrollStart + stats.netProfit;
  const bankrollGrowth = bankrollStart > 0 ? Math.round((stats.netProfit / bankrollStart) * 1000) / 10 : null;
  const balanceTimeline = stats.timeline.map((p) => ({ ...p, balance: bankrollStart + p.profit }));
  const showBankroll = bankrollStart > 0 && w.bankroll !== false;

  // First-run onboarding: guide brand-new accounts before there's any data.
  if (stats.totalBets === 0) {
    return (
      <div className="main">
        <div className="page-head">
          <div>
            <h1>Welcome{settings.sharing?.displayName ? `, ${settings.sharing.displayName}` : ''}</h1>
            <p>Let's get your tracker set up.</p>
          </div>
        </div>
        <div className="gs-list">
          <div className="gs-card">
            <div className="gs-num">1</div>
            <div className="gs-content">
              <h4>Log your first bet</h4>
              <p>Add the stake, odds and result — we work out your profit and win rate for you.</p>
              <Link to="/bets?new=1" state={{ returnTo: '/' }} className="btn-ghost btn-sm">+ Add a bet</Link>
            </div>
          </div>
          <div className="gs-card">
            <div className="gs-num">2</div>
            <div className="gs-content">
              <h4>Make it yours</h4>
              <p>Choose your currency and odds format, then pick the stats you want on your dashboard.</p>
              <Link to="/customise" className="btn-ghost btn-sm">Customise</Link>
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
              {enabledCards.map((c) => (
                <StatCard key={c.key} statKey={c.key} stats={stats} currency={currency} staking={staking} />
              ))}
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>These fill in as soon as you start logging bets.</p>
          </>
        )}

        <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 22 }}>Please gamble responsibly.</p>
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
        <Link to="/bets?new=1" state={{ returnTo: '/' }} className="btn-primary" style={{ display: 'inline-block' }}>+ Add bet</Link>
      </div>

      {enabledCards.length === 0 ? (
        <div className="card empty">No stat cards enabled — turn some on in Customise.</div>
      ) : (
        <div className="stat-grid">
          {enabledCards.map((c) => (
            <StatCard key={c.key} statKey={c.key} stats={stats} currency={currency} staking={staking} />
          ))}
        </div>
      )}

      {showBankroll && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="row spread" style={{ marginBottom: 14 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Bankroll</h3>
            {bankrollGrowth != null && (
              <span className={bankrollGrowth > 0 ? 'pos' : bankrollGrowth < 0 ? 'neg' : 'muted'} style={{ fontWeight: 700, fontSize: 14 }}>
                {bankrollGrowth > 0 ? '+' : ''}{bankrollGrowth}%
              </span>
            )}
          </div>
          <div className="stat-grid" style={{ marginBottom: balanceTimeline.length ? 16 : 0 }}>
            <div className="stat"><div className="label">Starting</div><div className="value">{formatStake(bankrollStart, currency, staking)}</div></div>
            <div className="stat"><div className="label">Balance</div><div className={`value ${balance > bankrollStart ? 'pos' : balance < bankrollStart ? 'neg' : ''}`}>{formatStake(balance, currency, staking)}</div></div>
            <div className="stat"><div className="label">Profit</div><div className={`value ${stats.netProfit > 0 ? 'pos' : stats.netProfit < 0 ? 'neg' : ''}`}>{formatStake(stats.netProfit, currency, staking, { signed: true })}</div></div>
          </div>
          {balanceTimeline.length > 0 && (
            <ProfitChart
              timeline={balanceTimeline}
              primary={settings.theme.primary}
              height={200}
              dataKey="balance"
              baseline={bankrollStart}
              tooltipLabel="Balance"
              formatValue={(v) => formatStake(v, currency, staking)}
            />
          )}
        </div>
      )}

      {w.pendingBets !== false && pending.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="row spread" style={{ marginBottom: 14 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Open bets ({pending.length})</h3>
            <span className="muted" style={{ fontSize: 13 }}>
              {formatStake(pendingStaked, currency, staking)} staked · {formatStake(pendingReturn, currency, staking)} to return
            </span>
          </div>
          <div className="stack">
            {pending.slice(0, 8).map((b) => (
              <div key={b.id} className="row spread" style={{ flexWrap: 'wrap', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{b.selection || b.event || b.sport || 'Bet'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {formatDate(b.placed_at)} · {formatStake(b.stake, currency, staking)} @ {formatOdds(b.odds, settings.oddsFormat)} → {formatStake(b.stake * b.odds, currency, staking)}
                  </div>
                </div>
                <SettleControls bet={b} onSettle={(status) => settle(b, status)} />
              </div>
            ))}
          </div>
          {pending.length > 8 && <Link to="/bets" className="muted" style={{ fontSize: 13, display: 'inline-block', marginTop: 10 }}>View all {pending.length} open bets →</Link>}
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
                          {formatStake(s.profit, currency, staking, { signed: true })}
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
