// Default per-user customization. Everything about how the tracker looks and
// what it shows lives here so the whole dashboard is user-controlled.

export const DEFAULT_SETTINGS = {
  // Appearance
  theme: {
    mode: 'dark', // 'dark' | 'light'
    primary: '#22c55e', // accent / brand colour of the dashboard
    accent: '#3b82f6',
    background: '#0b1120', // used in dark mode
    surface: '#111a2e',
    font: 'system',
  },
  currency: 'GBP', // GBP | USD | EUR | AUD | CAD
  oddsFormat: 'decimal', // 'decimal' | 'fractional' | 'american'

  // Which summary stat cards appear on the dashboard, and in what order.
  // Users can toggle any of these off if they don't care about them.
  statCards: [
    { key: 'netProfit', enabled: true },
    { key: 'roi', enabled: true },
    { key: 'winRate', enabled: true },
    { key: 'totalStaked', enabled: true },
    { key: 'totalBets', enabled: true },
    { key: 'pending', enabled: true },
    { key: 'biggestWin', enabled: false },
    { key: 'currentStreak', enabled: false },
  ],

  // Which dashboard sections/widgets are visible.
  widgets: {
    profitChart: true,
    sportBreakdown: true,
    recentBets: true,
  },

  // Which fields the user cares about tracking. Hidden fields are removed from
  // the bet form and the table so the tracker only shows what they want.
  fields: {
    sport: true,
    event: true,
    selection: true,
    betType: true,
    bookmaker: true,
    stake: true,
    odds: true,
    status: true,
    payout: true,
    notes: true,
    tags: false,
  },

  // Sharing preferences: what a public share page is allowed to reveal.
  sharing: {
    showProfit: true,
    showRoi: true,
    showWinRate: true,
    showStakes: false, // hide raw money amounts by default for privacy
    showRecentBets: true,
    displayName: '',
  },
};

export function mergeSettings(saved) {
  if (!saved) return structuredClone(DEFAULT_SETTINGS);
  const base = structuredClone(DEFAULT_SETTINGS);
  return {
    ...base,
    ...saved,
    theme: { ...base.theme, ...(saved.theme || {}) },
    widgets: { ...base.widgets, ...(saved.widgets || {}) },
    fields: { ...base.fields, ...(saved.fields || {}) },
    sharing: { ...base.sharing, ...(saved.sharing || {}) },
    statCards: Array.isArray(saved.statCards) && saved.statCards.length
      ? saved.statCards
      : base.statCards,
  };
}
