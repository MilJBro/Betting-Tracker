import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { requireAdmin } from '../lib/admin.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const DAY = 24 * 60 * 60 * 1000;
const one = (sql, ...p) => db.prepare(sql).get(...p);
const all = (sql, ...p) => db.prepare(sql).all(...p);

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Everything the private Insights page needs, in one call it can poll for a
// live feel. `days` selects the trailing window for the range figures.
router.get('/stats', (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
  const now = Date.now();
  const since = now - days * DAY;
  const liveSince = now - 3 * 60 * 1000; // "online now" = active in last 3 min
  const todayMs = startOfTodayMs();
  const sinceIso = new Date(since).toISOString();
  const todayIso = new Date(todayMs).toISOString();

  const liveNow = one('SELECT COUNT(DISTINCT session_id) n FROM analytics_events WHERE ts >= ?', liveSince).n;

  // What those live visitors are currently looking at (their latest page).
  const liveRows = all(
    `SELECT session_id, path, MAX(ts) mt FROM analytics_events
       WHERE ts >= ? AND kind = 'view' GROUP BY session_id`,
    liveSince
  );
  const liveByPageMap = {};
  for (const r of liveRows) liveByPageMap[r.path] = (liveByPageMap[r.path] || 0) + 1;
  const livePages = Object.entries(liveByPageMap)
    .map(([path, n]) => ({ path, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);

  const today = {
    visitors: one('SELECT COUNT(DISTINCT session_id) n FROM analytics_events WHERE ts >= ?', todayMs).n,
    views: one("SELECT COUNT(*) n FROM analytics_events WHERE kind = 'view' AND ts >= ?", todayMs).n,
    signups: one('SELECT COUNT(*) n FROM users WHERE created_at >= ?', todayIso).n,
  };

  const range = {
    visitors: one('SELECT COUNT(DISTINCT session_id) n FROM analytics_events WHERE ts >= ?', since).n,
    views: one("SELECT COUNT(*) n FROM analytics_events WHERE kind = 'view' AND ts >= ?", since).n,
    signups: one('SELECT COUNT(*) n FROM users WHERE created_at >= ?', sinceIso).n,
  };

  // Average active session length (seconds): first→last event within a session.
  const durRow = one(
    `SELECT AVG(d) a FROM (
        SELECT (MAX(ts) - MIN(ts)) d FROM analytics_events WHERE ts >= ? GROUP BY session_id
     )`,
    since
  );
  range.avgSessionSec = Math.round((durRow.a || 0) / 1000);

  const totals = {
    users: one('SELECT COUNT(*) n FROM users').n,
    pro: one("SELECT COUNT(*) n FROM users WHERE plan = 'pro'").n,
  };

  // Daily visitors + views for the trend chart (local day buckets).
  const series = all(
    `SELECT date(ts / 1000, 'unixepoch', 'localtime') d,
            COUNT(DISTINCT session_id) visitors,
            SUM(CASE WHEN kind = 'view' THEN 1 ELSE 0 END) views
       FROM analytics_events WHERE ts >= ? GROUP BY d ORDER BY d`,
    since
  );

  // Signups per day, keyed by date, so the chart can overlay growth.
  const signupRows = all(
    "SELECT substr(created_at, 1, 10) d, COUNT(*) n FROM users WHERE created_at >= ? GROUP BY d",
    sinceIso
  );
  const signupByDay = Object.fromEntries(signupRows.map((r) => [r.d, r.n]));

  const topPages = all(
    `SELECT path, COUNT(*) views, COUNT(DISTINCT session_id) visitors
       FROM analytics_events WHERE kind = 'view' AND ts >= ?
       GROUP BY path ORDER BY views DESC LIMIT 10`,
    since
  );

  // Where visitors are from (2-letter ISO country codes), by unique visitors.
  const topCountries = all(
    `SELECT country, COUNT(DISTINCT session_id) visitors
       FROM analytics_events WHERE ts >= ? AND country IS NOT NULL
       GROUP BY country ORDER BY visitors DESC LIMIT 10`,
    since
  );

  // Signed-in people active in the app (distinct accounts seen by the beacon).
  const activeUsers = (ms) => one('SELECT COUNT(DISTINCT user_id) n FROM analytics_events WHERE user_id IS NOT NULL AND ts >= ?', ms).n;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const sevenAgoIso = new Date(now - 7 * DAY).toISOString();
  const usersWithBets = (min) => one('SELECT COUNT(*) n FROM (SELECT user_id FROM bets GROUP BY user_id HAVING COUNT(*) >= ?)', min).n;
  const oldUsers = one('SELECT COUNT(*) n FROM users WHERE created_at < ?', sevenAgoIso).n;
  const oldAndActive = one(
    `SELECT COUNT(DISTINCT u.id) n FROM users u JOIN analytics_events e ON e.user_id = u.id
      WHERE u.created_at < ? AND e.ts >= ?`, sevenAgoIso, now - 7 * DAY).n;
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

  const engagement = {
    dau: activeUsers(todayMs),
    wau: activeUsers(now - 7 * DAY),
    mau: activeUsers(now - 30 * DAY),
    // Of people who signed up more than a week ago, how many were back this week.
    retention7: pct(oldAndActive, oldUsers),
    retentionBase: oldUsers,
    // Signup -> first bet -> regular use.
    withBet: usersWithBets(1),
    withFive: usersWithBets(5),
    withTen: usersWithBets(10),
    betsToday: one('SELECT COUNT(*) n FROM bets WHERE created_at >= ?', todayIso).n,
    betsRange: one('SELECT COUNT(*) n FROM bets WHERE created_at >= ?', sinceIso).n,
    betsTotal: one('SELECT COUNT(*) n FROM bets').n,
    scansThisMonth: one('SELECT COALESCE(SUM(scan_count), 0) n FROM users WHERE scan_month = ?', thisMonth).n,
    shares: one('SELECT COUNT(*) n FROM shares').n,
    // Logged-out landing-page visitors vs the signups they produced.
    landingVisitors: one("SELECT COUNT(DISTINCT session_id) n FROM analytics_events WHERE kind = 'view' AND path = '/' AND user_id IS NULL AND ts >= ?", since).n,
  };

  res.json({
    generatedAt: now,
    engagement,
    days,
    liveNow,
    livePages,
    today,
    range,
    totals,
    series: series.map((s) => ({ ...s, signups: signupByDay[s.d] || 0 })),
    topPages,
    topCountries,
  });
});

export default router;
