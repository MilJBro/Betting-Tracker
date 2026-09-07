// Performance metrics derived from a user's bets. Kept server-side so the
// dashboard and the public share page report identical numbers.

function profitOf(bet) {
  // Only settled bets contribute to realised profit.
  if (bet.status === 'won') return (bet.payout ?? bet.stake * bet.odds) - bet.stake;
  if (bet.status === 'lost') return -bet.stake;
  if (bet.status === 'void' || bet.status === 'cashout') {
    return (bet.payout ?? bet.stake) - bet.stake;
  }
  return 0; // pending
}

export function computeStats(bets) {
  const settled = bets.filter((b) =>
    ['won', 'lost', 'void', 'cashout'].includes(b.status)
  );
  const pending = bets.filter((b) => b.status === 'pending');

  const totalStaked = settled.reduce((s, b) => s + b.stake, 0);
  const netProfit = settled.reduce((s, b) => s + profitOf(b), 0);
  const wins = settled.filter((b) => b.status === 'won').length;
  const decisive = settled.filter((b) =>
    ['won', 'lost'].includes(b.status)
  ).length;

  const roi = totalStaked > 0 ? (netProfit / totalStaked) * 100 : 0;
  const winRate = decisive > 0 ? (wins / decisive) * 100 : 0;

  const biggestWin = settled.reduce(
    (max, b) => Math.max(max, profitOf(b)),
    0
  );
  const pendingStake = pending.reduce((s, b) => s + b.stake, 0);

  // Current streak based on chronological order of decisive bets.
  const ordered = settled
    .filter((b) => ['won', 'lost'].includes(b.status))
    .sort((a, b) => new Date(a.placed_at) - new Date(b.placed_at));
  let streak = 0;
  let streakType = null;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const t = ordered[i].status;
    if (streakType === null) {
      streakType = t;
      streak = 1;
    } else if (t === streakType) {
      streak += 1;
    } else break;
  }

  // Profit over time (cumulative) for the chart.
  const timeline = [];
  let running = 0;
  for (const b of settled.sort(
    (a, b) => new Date(a.placed_at) - new Date(b.placed_at)
  )) {
    running += profitOf(b);
    timeline.push({
      date: b.placed_at,
      profit: Number(running.toFixed(2)),
    });
  }

  // Breakdown by sport / category.
  const bySport = {};
  for (const b of settled) {
    const key = b.sport || 'Uncategorised';
    if (!bySport[key]) bySport[key] = { sport: key, profit: 0, bets: 0, staked: 0 };
    bySport[key].profit += profitOf(b);
    bySport[key].staked += b.stake;
    bySport[key].bets += 1;
  }
  const sportBreakdown = Object.values(bySport)
    .map((s) => ({
      ...s,
      profit: Number(s.profit.toFixed(2)),
      roi: s.staked > 0 ? Number(((s.profit / s.staked) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  return {
    netProfit: Number(netProfit.toFixed(2)),
    totalStaked: Number(totalStaked.toFixed(2)),
    roi: Number(roi.toFixed(1)),
    winRate: Number(winRate.toFixed(1)),
    totalBets: bets.length,
    settledBets: settled.length,
    pending: pending.length,
    pendingStake: Number(pendingStake.toFixed(2)),
    biggestWin: Number(biggestWin.toFixed(2)),
    currentStreak: streak,
    streakType,
    timeline,
    sportBreakdown,
  };
}

export { profitOf };
