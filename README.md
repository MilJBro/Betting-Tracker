# Betting Tracker

A fully customizable betting tracker. Create an account, log your bets, and
watch your profit, ROI and win rate build up on a dashboard you control — then
share a read-only page of how you're getting on.

## Features

- **Accounts** — register and log in; your bets are private by default.
  Passwords are hashed (bcrypt) and sessions use JWTs.
- **Bet logging** — record date, sport/category, event, selection, bet type,
  bookmaker, stake, odds, status (pending / won / lost / void / cash-out),
  payout, notes and tags. Profit, ROI and win rate are calculated for you.
- **A dashboard you customise**
  - Change the **dashboard colour**, accent colour, background and font.
  - **Dark or light** mode.
  - Pick your **currency** (GBP/USD/EUR/AUD/CAD) and **odds format**
    (decimal / fractional / American).
  - Choose **which stat cards** appear (net profit, ROI, win rate, total
    staked, pending, biggest win, current streak…) and **reorder** them.
  - Toggle dashboard **sections** on/off (profit chart, sport breakdown,
    recent bets).
- **Track only what you want** — hide any bet fields you don't care about and
  they disappear from both the form and the table.
- **Sharing** — publish a read-only page of your performance with a single
  link, and control exactly what it reveals (profit, ROI, win rate, whether
  stake amounts are shown, recent bets). Money is hidden by default for
  privacy.

## Tech stack

| Layer    | Choice                                             |
|----------|----------------------------------------------------|
| Frontend | React + Vite + React Router, Recharts for charts   |
| Backend  | Node.js + Express                                  |
| Storage  | SQLite (via better-sqlite3) — zero-config, on disk |
| Auth     | JWT + bcrypt                                        |

## Project structure

```
betting-tracker/
├── server/                 # Express API + SQLite
│   └── src/
│       ├── index.js        # app entry (also serves the built client)
│       ├── lib/            # db, auth, defaults, stats
│       └── routes/         # auth, bets, settings, share
└── client/                 # React + Vite single-page app
    └── src/
        ├── pages/          # Auth, Dashboard, Bets, Customise, Share
        ├── components/     # StatCard, ProfitChart, BetForm, Toggle
        └── context/        # Auth + Settings/theme providers
```

## Getting started

Requires Node.js 18+.

```bash
# 1. Install dependencies for both apps
npm run install:all

# 2. Build the frontend
npm run build

# 3. Start the server (serves the API and the built app)
npm start
# → http://localhost:4000
```

Open http://localhost:4000, create an account, and start tracking.

### Development (hot reload)

Run the API and the Vite dev server in two terminals:

```bash
npm run dev:server   # API on :4000
npm run dev:client   # Vite dev server on :5173 (proxies /api to :4000)
```

Then open http://localhost:5173.

## Configuration

The server reads a few optional environment variables:

| Variable     | Default                        | Purpose                          |
|--------------|--------------------------------|----------------------------------|
| `PORT`       | `4000`                         | API / app port                   |
| `JWT_SECRET` | `dev-secret-change-me…`        | **Set this in production**       |
| `DB_PATH`    | `server/data/betting-tracker.db` | SQLite database file location  |

## API overview

| Method & path                     | Auth | Description                     |
|-----------------------------------|------|---------------------------------|
| `POST /api/auth/register`         | —    | Create an account               |
| `POST /api/auth/login`            | —    | Log in                          |
| `GET  /api/auth/me`               | ✓    | Current user                    |
| `GET/POST/PUT/DELETE /api/bets`   | ✓    | Manage bets                     |
| `GET  /api/bets/stats`            | ✓    | Aggregated performance stats    |
| `GET/PUT /api/settings`           | ✓    | Read / save customisation       |
| `POST /api/share/enable`          | ✓    | Turn on a public share link     |
| `GET  /api/share/public/:id`      | —    | Public performance page data    |

## Notes

This is a self-hosted MVP intended for personal use. Please gamble responsibly.
