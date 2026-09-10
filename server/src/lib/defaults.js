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

  // Staking display. Money is always the source of truth; `unitSize` is the
  // currency value of 1 unit, used to convert to/from units.
  staking: {
    mode: 'currency', // 'currency' | 'units' | 'both'
    unitSize: 10, // e.g. 1u = £10
  },

  // Pre-fill values for a new bet, to save typing the same thing each time.
  // Empty = no default. `stake` is in the account currency (or units when the
  // user stakes in units — the form converts as usual).
  defaults: {
    stake: '',
    bookmaker: '',
  },

  // Teams the user has entered on a bet, remembered for autocomplete. Kept
  // sorted alphabetically. Grows as new teams are used.
  teams: [],

  // Bankroll tracking. `starting` is the bankroll you began with (in the
  // account currency); current balance is derived as starting + net profit.
  bankroll: {
    starting: 0,
  },

  // Which summary stat cards appear on the dashboard, and in what order.
  // Users can toggle any of these off if they don't care about them.
  // A calm default set — four cards. The rest are available in Customise.
  statCards: [
    { key: 'netProfit', enabled: true },
    { key: 'roi', enabled: true },
    { key: 'winRate', enabled: true },
    { key: 'pending', enabled: true },
    { key: 'totalStaked', enabled: false },
    { key: 'totalBets', enabled: false },
    { key: 'biggestWin', enabled: false },
    { key: 'currentStreak', enabled: false },
  ],

  // Which dashboard sections/widgets are visible. Sport breakdown and recent
  // bets are off by default (a tap away on other pages) to keep it uncluttered.
  widgets: {
    bankroll: true,
    pendingBets: true,
    profitChart: true,
    sportBreakdown: false,
    recentBets: false,
  },

  // Which fields the user cares about tracking. Hidden fields are removed from
  // the bet form and the table so the tracker only shows what they want.
  fields: {
    sport: true,
    event: true,
    selection: true,
    betType: true,
    bookmaker: true,
    tipster: false, // switched on for users who follow tipsters
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

  // Bettor profile, gathered from the sign-up questionnaire. `onboarded`
  // gates whether the questionnaire still needs to be shown.
  profile: {
    onboarded: false,
    trackingStyle: '', // 'own' | 'tipster' | 'both'
    sports: [],
    frequency: '', // 'daily' | 'weekly' | 'occasional'
    goal: '', // 'profit' | 'discipline' | 'fun' | 'analyse'
    experience: '', // 'new' | 'casual' | 'experienced' | 'serious'
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
    staking: { ...base.staking, ...(saved.staking || {}) },
    defaults: { ...base.defaults, ...(saved.defaults || {}) },
    bankroll: { ...base.bankroll, ...(saved.bankroll || {}) },
    profile: { ...base.profile, ...(saved.profile || {}) },
    statCards: Array.isArray(saved.statCards) && saved.statCards.length
      ? saved.statCards
      : base.statCards,
  };
}
