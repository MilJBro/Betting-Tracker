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

// --- Deeper analytics for the Insights page ---------------------------------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ODDS_BANDS = [
  { max: 1.5, label: 'Odds-on (<1.5)' },
  { max: 2.0, label: '1.5 – 2.0' },
  { max: 3.0, label: '2.0 – 3.0' },
  { max: 5.0, label: '3.0 – 5.0' },
  { max: 11.0, label: '5.0 – 11.0' },
  { max: Infinity, label: '11.0+' },
];

function bucket(rows, keyFn) {
  const map = new Map();
  for (const b of rows) {
    const key = keyFn(b);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(b);
  }
  return map;
}

function summarise(rows) {
  const staked = rows.reduce((s, b) => s + b.stake, 0);
  const profit = rows.reduce((s, b) => s + profitOf(b), 0);
  const decisive = rows.filter((b) => ['won', 'lost'].includes(b.status));
  const wins = decisive.filter((b) => b.status === 'won').length;
  return {
    bets: rows.length,
    staked: Number(staked.toFixed(2)),
    profit: Number(profit.toFixed(2)),
    roi: staked > 0 ? Number(((profit / staked) * 100).toFixed(1)) : 0,
    winRate: decisive.length ? Number(((wins / decisive.length) * 100).toFixed(1)) : 0,
  };
}

export function computeAnalytics(bets) {
  const settled = bets.filter((b) => ['won', 'lost', 'void', 'cashout'].includes(b.status));

  // Monthly P/L, chronological.
  const byMonth = bucket(settled, (b) => (b.placed_at || '').slice(0, 7)); // YYYY-MM
  const monthly = [...byMonth.entries()]
    .filter(([k]) => k)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, rows]) => {
      const [y, m] = k.split('-');
      return { month: k, label: `${MONTHS[Number(m) - 1]} ${y}`, ...summarise(rows) };
    });

  // By bookmaker (most profitable first).
  const byBookmaker = [...bucket(settled, (b) => b.bookmaker || 'Unknown').entries()]
    .map(([bookmaker, rows]) => ({ bookmaker, ...summarise(rows) }))
    .sort((a, b) => b.profit - a.profit);

  // By odds band.
  const byOddsBand = ODDS_BANDS.map((band, i) => {
    const lo = i === 0 ? 0 : ODDS_BANDS[i - 1].max;
    const rows = settled.filter((b) => b.odds >= lo && b.odds < band.max);
    return { band: band.label, ...summarise(rows) };
  }).filter((b) => b.bets > 0);

  // By day of week.
  const byDay = DOW.map((day, i) => {
    const rows = settled.filter((b) => {
      const d = new Date((b.placed_at || '').length <= 10 ? b.placed_at + 'T00:00:00' : b.placed_at);
      return d.getDay() === i;
    });
    return { day, ...summarise(rows) };
  });

  // Streaks over decisive bets, chronological.
  const decisive = settled
    .filter((b) => ['won', 'lost'].includes(b.status))
    .sort((a, b) => new Date(a.placed_at) - new Date(b.placed_at));
  let longestWin = 0, longestLoss = 0, runW = 0, runL = 0, current = 0, currentType = null;
  for (const b of decisive) {
    if (b.status === 'won') { runW++; runL = 0; longestWin = Math.max(longestWin, runW); }
    else { runL++; runW = 0; longestLoss = Math.max(longestLoss, runL); }
  }
  for (let i = decisive.length - 1; i >= 0; i--) {
    const t = decisive[i].status;
    if (currentType === null) { currentType = t; current = 1; }
    else if (t === currentType) current++;
    else break;
  }

  const profits = settled.map(profitOf);
  const biggestWin = profits.length ? Math.max(0, ...profits) : 0;
  const biggestLoss = profits.length ? Math.min(0, ...profits) : 0;

  return {
    overall: summarise(settled),
    monthly,
    byBookmaker,
    byOddsBand,
    byDay,
    streaks: { longestWin, longestLoss, current, currentType },
    biggestWin: Number(biggestWin.toFixed(2)),
    biggestLoss: Number(biggestLoss.toFixed(2)),
  };
}

export { profitOf };
