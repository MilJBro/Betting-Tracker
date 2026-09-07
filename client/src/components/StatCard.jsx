import { money, formatStake } from '../format.js';

// Metadata for every possible stat card the user can enable.
export const STAT_META = {
  netProfit: { label: 'Net Profit', kind: 'money-signed' },
  roi: { label: 'ROI', kind: 'percent' },
  winRate: { label: 'Win Rate', kind: 'percent' },
  totalStaked: { label: 'Total Staked', kind: 'money' },
  totalBets: { label: 'Total Bets', kind: 'count' },
  pending: { label: 'Pending', kind: 'pending' },
  biggestWin: { label: 'Biggest Win', kind: 'money-signed' },
  currentStreak: { label: 'Current Streak', kind: 'streak' },
};

export default function StatCard({ statKey, stats, currency, staking }) {
  const meta = STAT_META[statKey];
  if (!meta) return null;

  let value = '—';
  let cls = '';
  let sub = '';

  switch (meta.kind) {
    case 'money-signed': {
      const v = stats[statKey] ?? 0;
      value = formatStake(v, currency, staking, { signed: true });
      cls = v > 0 ? 'pos' : v < 0 ? 'neg' : '';
      break;
    }
    case 'money':
      value = formatStake(stats[statKey] ?? 0, currency, staking);
      break;
    case 'percent': {
      const v = stats[statKey] ?? 0;
      value = `${v}%`;
      if (statKey === 'roi') cls = v > 0 ? 'pos' : v < 0 ? 'neg' : '';
      break;
    }
    case 'count':
      value = stats[statKey] ?? 0;
      sub = `${stats.settledBets ?? 0} settled`;
      break;
    case 'pending':
      value = stats.pending ?? 0;
      sub = formatStake(stats.pendingStake ?? 0, currency, staking) + ' at stake';
      break;
    case 'streak': {
      const n = stats.currentStreak ?? 0;
      value = n === 0 ? '—' : `${n} ${stats.streakType === 'won' ? 'W' : 'L'}`;
      cls = stats.streakType === 'won' ? 'pos' : n ? 'neg' : '';
      break;
    }
    default:
      value = stats[statKey] ?? '—';
  }

  return (
    <div className="stat">
      <div className="label">{meta.label}</div>
      <div className={`value ${cls}`}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
