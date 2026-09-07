# Betting Tracker

A fully customizable betting tracker. Create an account, log your bets, and
watch your profit, ROI and win rate build up on a dashboard you control — then
share a read-only page of how you're getting on.

## Features

- **Accounts** — register and log in; your bets are private by default.
  Passwords are hashed (bcrypt) and sessions use JWTs. Full account
  self-service: **change password**, **forgot / reset password** (emailed
  link), **log out everywhere**, **export my data** (JSON), and
  **delete account**. Auth endpoints are rate-limited, security headers are
  set with Helmet, and changing or resetting a password invalidates existing
  sessions.
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
- **Search, filter & sort** — on the My Bets page, search across selection,
  event, sport, bookmaker and notes; filter by sport, bookmaker, status and a
  date range; sort by date, stake, odds or profit; and see live totals
  (staked, net profit, ROI) for whatever slice you've filtered to.
- **Analytics** — an Insights page with monthly profit/loss, ROI by odds
  range and by bookmaker, win/loss streaks, day-of-week performance and your
  biggest win and loss.
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

The server reads these environment variables:

| Variable        | Default (dev)                    | Purpose                                                        |
|-----------------|----------------------------------|---------------------------------------------------------------|
| `NODE_ENV`      | `development`                    | Set to `production` for a live deployment.                    |
| `PORT`          | `4000`                           | API / app port.                                              |
| `JWT_SECRET`    | auto-generated at `data/.jwt-secret` | Signing key for sessions. **Required in production** — the server refuses to start without it. |
| `JWT_TTL`       | `30d`                            | How long a session token stays valid.                        |
| `DB_PATH`       | `server/data/betting-tracker.db` | SQLite database file location.                               |
| `APP_URL`       | `http://localhost:PORT`          | Public base URL, used to build password-reset links.         |
| `CORS_ORIGINS`  | _(empty)_                        | Comma-separated allowlist of origins. Empty = same-origin only. |
| `SMTP_HOST`     | _(empty)_                        | SMTP server for password-reset emails. Without it, reset links are logged to the console (dev). |
| `SMTP_PORT`     | `587`                            | SMTP port (`465` uses TLS).                                  |
| `SMTP_USER` / `SMTP_PASS` | _(empty)_              | SMTP credentials.                                            |
| `MAIL_FROM`     | `Betting Tracker <no-reply@…>`   | From-address on outgoing email.                              |

In development, if `JWT_SECRET` isn't set the server generates one and stores
it at `server/data/.jwt-secret` so your sessions survive restarts. If SMTP
isn't configured, `POST /api/auth/forgot-password` returns the reset link in
its response (dev only) so the flow is testable without an email provider.

## API overview

| Method & path                     | Auth | Description                     |
|-----------------------------------|------|---------------------------------|
| `POST /api/auth/register`         | —    | Create an account               |
| `POST /api/auth/login`            | —    | Log in                          |
| `GET  /api/auth/me`               | ✓    | Current user                    |
| `POST /api/auth/change-password`  | ✓    | Change password (rotates token) |
| `POST /api/auth/forgot-password`  | —    | Request a reset link            |
| `POST /api/auth/reset-password`   | —    | Set a new password via token    |
| `POST /api/auth/logout-all`       | ✓    | Invalidate all sessions         |
| `GET  /api/auth/export`           | ✓    | Download all your data (JSON)   |
| `DELETE /api/auth/account`        | ✓    | Delete account (password req.)  |
| `GET/POST/PUT/DELETE /api/bets`   | ✓    | Manage bets                     |
| `GET  /api/bets/stats`            | ✓    | Aggregated performance stats    |
| `GET  /api/bets/analytics`        | ✓    | Monthly / odds / bookmaker insights |
| `GET/PUT /api/settings`           | ✓    | Read / save customisation       |
| `POST /api/share/enable`          | ✓    | Turn on a public share link     |
| `GET  /api/share/public/:id`      | —    | Public performance page data    |

## Notes

This is a self-hosted MVP intended for personal use. Please gamble responsibly.
