// Blog articles. Kept as structured data (headings / paragraphs / lists) so the
// pages render without a markdown dependency, and so titles/descriptions can
// feed the per-page SEO tags. Newest first.

export const POSTS = [
  {
    slug: 'how-to-track-your-bets',
    title: 'How to track your bets (and actually know if you’re winning)',
    description:
      'A simple, honest guide to tracking your bets — what to record, why it matters, and how to finally see whether you’re up or down.',
    date: '2026-09-14',
    read: '5 min read',
    content: [
      { p: 'Most bettors have no idea whether they’re actually winning. They remember the big wins, forget the quiet losses, and “feel” like they’re about even. The only way to know the truth is to track every bet. Here’s how to do it properly — without a messy spreadsheet.' },
      { h2: 'Why tracking changes everything' },
      { p: 'When you write every bet down, three things happen. You stop lying to yourself about your record. You start spotting which sports, bookies and bet types actually make you money. And you naturally bet more carefully, because you know it’s being counted.' },
      { p: 'It’s the single highest-value habit in betting, and it costs you nothing but a few seconds per bet.' },
      { h2: 'What to record for every bet' },
      { p: 'You don’t need much. For each bet, log:' },
      { ul: [
        'The selection and the event (what you backed, and in what game or race).',
        'The stake — how much you put on.',
        'The odds you took.',
        'The bookmaker.',
        'The result — won, lost, void or cashed out — and the actual return.',
      ] },
      { p: 'That’s enough to calculate everything that matters: profit, ROI and win rate. Optional extras like the tipster, sport, or a note help you break results down later.' },
      { h2: 'Track profit in money and units' },
      { p: 'Money profit tells you what’s in your pocket. Units tell you how well you’re actually betting, independent of stake size. A unit is simply a fixed slice of your bankroll (say £10). Winning 5 units is a good month whether your unit is £2 or £200 — so serious bettors judge themselves in units.' },
      { p: 'The best trackers show you both at once, so you can see you’re “+£120 / +12u” at a glance.' },
      { h2: 'Review it regularly' },
      { p: 'Tracking is only useful if you look back. Once a week, check your net profit and ROI, and ask: which sport is carrying me? Which bookie or bet type is leaking money? Cut what loses, lean into what wins.' },
      { h2: 'Make it effortless' },
      { p: 'The reason people quit tracking is friction — spreadsheets are slow and ugly on a phone. Betbooks is built to log a bet in seconds and show your profit, ROI, win rate and unit performance automatically, so the habit actually sticks.' },
    ],
  },
  {
    slug: 'betting-roi-explained',
    title: 'Betting ROI explained: the one number that matters',
    description:
      'What ROI means in betting, how to calculate it, and why it’s a better measure of your betting than raw profit or win rate.',
    date: '2026-09-13',
    read: '4 min read',
    content: [
      { p: 'Ask a sharp bettor how they’re doing and they won’t tell you their win rate — they’ll tell you their ROI. Here’s what it means, how to work it out, and why it’s the number to obsess over.' },
      { h2: 'What is ROI?' },
      { p: 'ROI (return on investment) is your profit as a percentage of everything you’ve staked. It answers: “for every £1 I put through, how much do I make back?”' },
      { p: 'The formula is simple:' },
      { ul: ['ROI = (total profit ÷ total staked) × 100'] },
      { p: 'If you’ve staked £1,000 across the season and you’re £70 up, your ROI is 7%. That means you make 7p of profit for every £1 you risk.' },
      { h2: 'Why ROI beats win rate' },
      { p: 'Win rate — the percentage of bets you win — is misleading on its own. You can win 70% of your bets and still lose money if you’re backing short-priced favourites, and you can win 35% and be hugely profitable backing big prices. Win rate ignores odds. ROI doesn’t.' },
      { h2: 'Why ROI beats raw profit' },
      { p: 'Raw profit doesn’t tell you how efficient you are. £200 profit from £500 staked (40% ROI) is elite. £200 profit from £20,000 staked (1% ROI) is barely beating the vig and one bad run from turning negative. ROI puts your profit in context.' },
      { h2: 'What’s a good ROI?' },
      { p: 'Be realistic. Professional sports bettors often operate on 3–5% ROI over huge volume — that’s genuinely excellent. Anything consistently above 0% over hundreds of bets means you’re beating the bookmaker, which most people never do. Short-term ROI swings wildly; judge it over a big sample.' },
      { h2: 'Track it automatically' },
      { p: 'You can’t improve what you don’t measure. Betbooks calculates your ROI for you as you log bets, and lets you break it down by sport, bookmaker and bet type — so you can see exactly where your edge is, and where it isn’t.' },
    ],
  },
  {
    slug: 'bankroll-management-and-staking',
    title: 'Bankroll management and staking: how to stay in the game',
    description:
      'Units, stake sizing and staking plans explained — the discipline that separates bettors who last from those who go bust.',
    date: '2026-09-12',
    read: '6 min read',
    content: [
      { p: 'You can pick winners and still go broke. The bettors who last aren’t just good at finding value — they’re disciplined about how much they stake. This is bankroll management, and it’s the least glamorous, most important skill in betting.' },
      { h2: 'Your bankroll is your business capital' },
      { p: 'Your bankroll is the money you’ve set aside purely for betting — money you can afford to lose, kept separate from rent and bills. Treat it like a business’s working capital: protect it, and never top it up on tilt.' },
      { h2: 'Bet in units, not gut feelings' },
      { p: 'A unit is a fixed percentage of your bankroll — commonly 1–2%. If your bankroll is £500 and a unit is 1%, that’s £5 per unit. Instead of staking random amounts, you stake in units: a standard bet might be 1 unit, a strong one 2 units.' },
      { p: 'Why it works: units keep your stakes proportional to your bankroll, so a losing run can’t wipe you out, and a winning run scales up naturally.' },
      { h2: 'Common staking plans' },
      { ul: [
        'Flat staking — the same stake (e.g. 1 unit) on every bet. Boring, robust, and hard to beat for most people.',
        'Percentage staking — always stake a fixed % of your current bankroll, so stakes shrink when you’re down and grow when you’re up.',
        'Confidence-based — 1 unit for standard bets, 2 for strong ones. Only works if you’re honest about confidence.',
      ] },
      { p: 'For almost everyone, flat or percentage staking is the right answer. Avoid chasing losses by doubling up — that’s how bankrolls die.' },
      { h2: 'The rules that keep you alive' },
      { ul: [
        'Never stake more than a small % of your bankroll on one bet (1–2% is sensible).',
        'Never chase losses with bigger stakes to “get it back”.',
        'Set your unit size in advance and stick to it.',
        'Withdraw profit periodically so it’s real, not just a number.',
      ] },
      { h2: 'Measure yourself in units' },
      { p: 'Once you stake in units, judge your results in units too. “+8 units this month” is a clean measure of how well you bet, whatever your stake size. Betbooks tracks your unit profit alongside your money profit, and lets you set your unit size once so every bet is measured consistently.' },
      { p: 'Bet within your means, and if it ever stops being fun, stop. Free, confidential help is always available at begambleaware.org.' },
    ],
  },
];

export const getPost = (slug) => POSTS.find((p) => p.slug === slug);
