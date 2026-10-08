import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { requireAdmin } from '../lib/admin.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const DAY = 24 * 60 * 60 * 1000;
const one = (sql, ...p) => db.prepare(sql).get(...p);
const all = (sql, ...p) => db.prepare(sql).all(...p);

// "Today" starts at midnight in the VIEWER's time zone. The server runs in UTC,
// so the browser sends its offset (minutes behind UTC, as Date#getTimezoneOffset
// reports it) and we measure the day from there.
function tzOf(req) {
  const n = parseInt(req.query.tz, 10);
  return Number.isFinite(n) && Math.abs(n) <= 14 * 60 ? n : new Date().getTimezoneOffset();
}
export function startOfDayMs(tz, now = Date.now()) {
  return Math.floor((now - tz * 60000) / DAY) * DAY + tz * 60000;
}

// The time window a request asks for: `days=today` (midnight to now) or a
// trailing number of days. Today's charts bucket by hour instead of by day.
function windowOf(req) {
  const tz = tzOf(req);
  const now = Date.now();
  const todayMs = startOfDayMs(tz, now);
  if (String(req.query.days) === 'today') {
    return { today: true, days: 1, label: 'today', since: todayMs, sinceIso: new Date(todayMs).toISOString(), tz, todayMs, now };
  }
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
  const since = now - days * DAY;
  return { today: false, days, label: `${days} days`, since, sinceIso: new Date(since).toISOString(), tz, todayMs, now };
}
// SQL for the chart bucket of an analytics timestamp column (ms): hour of the
// viewer's day when looking at today, otherwise the server's calendar day.
const tsBucket = (win, col = 'ts') => win.today
  ? `strftime('%H', ${col} / 1000 - ${win.tz * 60}, 'unixepoch')`
  : `date(${col} / 1000, 'unixepoch', 'localtime')`;
// Same for an ISO created_at column.
const isoBucket = (win, col = 'created_at') => win.today
  ? `strftime('%H', ${col}, '${-win.tz >= 0 ? '+' : '-'}${Math.abs(win.tz)} minutes')`
  : `substr(${col}, 1, 10)`;
// Fill quiet hours (so far today) or days with zero so charts have no gaps.
function fillWindow(win, rows) {
  if (!win.today) return fillDays(rows, win.days);
  const map = new Map(rows.map((r) => [r.d, r.v]));
  const hoursSoFar = new Date(win.now - win.tz * 60000).getUTCHours();
  return Array.from({ length: hoursSoFar + 1 }, (_, h) => {
    const d = String(h).padStart(2, '0');
    return { d, v: map.get(d) || 0 };
  });
}

// Everything the private Insights page needs, in one call it can poll for a
// live feel. `days` selects the trailing window for the range figures.
router.get('/stats', (req, res) => {
  const win = windowOf(req);
  const { days, now, since, sinceIso, todayMs } = win;
  const liveSince = now - 3 * 60 * 1000; // "online now" = active in last 3 min
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
    `SELECT ${tsBucket(win)} d,
            COUNT(DISTINCT session_id) visitors,
            SUM(CASE WHEN kind = 'view' THEN 1 ELSE 0 END) views
       FROM analytics_events WHERE ts >= ? GROUP BY d ORDER BY d`,
    since
  );

  // Signups per day, keyed by date, so the chart can overlay growth.
  const signupRows = all(
    `SELECT ${isoBucket(win)} d, COUNT(*) n FROM users WHERE created_at >= ? GROUP BY d`,
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
    window: { today: win.today, label: win.label },
    series: (win.today
      ? fillWindow(win, []).map(({ d }) => series.find((x) => x.d === d) || { d, visitors: 0, views: 0 })
      : series
    ).map((s) => ({ ...s, signups: signupByDay[s.d] || 0 })),
    topPages,
    topCountries,
  });
});

// ---- Deep dives ------------------------------------------------------------
// Tapping a tile on the Insights page opens one of these. Each returns the same
// shape so the client can render any of them with one component:
//   { title, summary: [{label, value}], series?: {label, unit, data: [{d, v}]},
//     lists: [{title, page?, rows: [{label, value, sub?}]}] }
const MONTH_KEY = () => new Date().toISOString().slice(0, 7);

// Fill gaps so a chart shows quiet days as zero rather than skipping them.
function fillDays(rows, days) {
  const map = new Map(rows.map((r) => [r.d, r.v]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(Date.now() - i * DAY);
    const d = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    out.push({ d, v: map.get(d) || 0 });
  }
  return out;
}
const ago = (ms) => {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 129600) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};
const ago_iso = (iso) => ago(Date.parse(iso));
const pctStr = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '0%');

const DETAILS = {
  live() {
    const liveSince = Date.now() - 3 * 60 * 1000;
    const recent = all(
      `SELECT e.session_id, e.path, e.ts, e.country, u.username
         FROM analytics_events e LEFT JOIN users u ON u.id = e.user_id
        WHERE e.kind = 'view' AND e.ts >= ? ORDER BY e.ts DESC LIMIT 200`,
      Date.now() - 30 * 60 * 1000
    );
    const seen = new Set();
    const sessions = [];
    for (const r of recent) {
      if (seen.has(r.session_id)) continue;
      seen.add(r.session_id);
      sessions.push(r);
      if (sessions.length >= 15) break;
    }
    const byPage = all(
      `SELECT path label, COUNT(DISTINCT session_id) value FROM analytics_events
        WHERE kind = 'view' AND ts >= ? GROUP BY path ORDER BY value DESC LIMIT 10`, liveSince);
    return {
      title: 'Online now',
      summary: [
        { label: 'Online now', value: one('SELECT COUNT(DISTINCT session_id) n FROM analytics_events WHERE ts >= ?', liveSince).n },
        { label: 'Signed in', value: one('SELECT COUNT(DISTINCT session_id) n FROM analytics_events WHERE ts >= ? AND user_id IS NOT NULL', liveSince).n },
        { label: 'Seen in last 30 min', value: sessions.length >= 15 ? '15+' : sessions.length },
      ],
      lists: [
        { title: 'Where they are right now', page: true, rows: byPage },
        { title: 'Latest visits (last 30 min)', page: true, rows: sessions.map((r) => ({
          label: r.path, value: ago(r.ts),
          sub: `${r.username || 'Not signed in'}${r.country ? ' · ' + r.country : ''}` })) },
      ],
    };
  },

  visitors(win) {
    const { since } = win;
    const series = all(`SELECT ${tsBucket(win)} d, COUNT(DISTINCT session_id) v FROM analytics_events WHERE ts >= ? GROUP BY d`, since);
    const total = one('SELECT COUNT(DISTINCT session_id) n FROM analytics_events WHERE ts >= ?', since).n;
    const signedIn = one('SELECT COUNT(DISTINCT session_id) n FROM analytics_events WHERE ts >= ? AND user_id IS NOT NULL', since).n;
    return {
      title: `Visitors · ${win.label}`,
      summary: [
        { label: 'Visitors', value: total },
        { label: 'Signed in', value: `${signedIn} (${pctStr(signedIn, total)})` },
        { label: 'Logged out', value: total - signedIn },
      ],
      series: { label: win.today ? 'Visitors per hour' : 'Visitors per day', hourly: win.today, data: fillWindow(win, series) },
      lists: [
        { title: 'Where they landed first', page: true, rows: all(
          `SELECT path label, COUNT(*) value FROM (
              SELECT session_id, path, MIN(ts) FROM analytics_events
               WHERE kind = 'view' AND ts >= ? GROUP BY session_id)
            GROUP BY path ORDER BY value DESC LIMIT 10`, since) },
        { title: 'Countries', rows: all(
          `SELECT country label, COUNT(DISTINCT session_id) value FROM analytics_events
            WHERE ts >= ? AND country IS NOT NULL GROUP BY country ORDER BY value DESC LIMIT 10`, since) },
      ],
    };
  },

  views(win) {
    const { since, days } = win;
    const series = all(`SELECT ${tsBucket(win)} d, COUNT(*) v FROM analytics_events WHERE kind = 'view' AND ts >= ? GROUP BY d`, since);
    const views = one("SELECT COUNT(*) n FROM analytics_events WHERE kind = 'view' AND ts >= ?", since).n;
    const visitors = one('SELECT COUNT(DISTINCT session_id) n FROM analytics_events WHERE ts >= ?', since).n;
    return {
      title: `Page views · ${win.label}`,
      summary: [
        { label: 'Page views', value: views },
        { label: 'Per visitor', value: visitors ? (views / visitors).toFixed(1) : '0' },
        ...(win.today ? [] : [{ label: 'Per day', value: (views / days).toFixed(1) }]),
      ],
      series: { label: win.today ? 'Views per hour' : 'Views per day', hourly: win.today, data: fillWindow(win, series) },
      lists: [
        { title: 'Pages', page: true, rows: all(
          `SELECT path label, COUNT(*) value FROM analytics_events
            WHERE kind = 'view' AND ts >= ? GROUP BY path ORDER BY value DESC LIMIT 15`, since) },
      ],
    };
  },

  signups(win) {
    const { sinceIso } = win;
    const series = all(`SELECT ${isoBucket(win)} d, COUNT(*) v FROM users WHERE created_at >= ? GROUP BY d`, sinceIso);
    const recent = all(
      `SELECT u.username, u.plan, u.created_at,
              (SELECT COUNT(*) FROM bets b WHERE b.user_id = u.id) bets,
              (SELECT MAX(ts) FROM analytics_events e WHERE e.user_id = u.id) seen
         FROM users u ORDER BY u.created_at DESC LIMIT 25`);
    return {
      title: 'Signups',
      summary: [
        { label: win.today ? 'Today' : `Last ${win.days} days`, value: one('SELECT COUNT(*) n FROM users WHERE created_at >= ?', sinceIso).n },
        { label: 'All time', value: one('SELECT COUNT(*) n FROM users').n },
        { label: 'On Pro', value: one("SELECT COUNT(*) n FROM users WHERE plan = 'pro'").n },
      ],
      series: { label: win.today ? 'Signups per hour' : 'Signups per day', hourly: win.today, data: fillWindow(win, series) },
      lists: [
        { title: 'Newest accounts', rows: recent.map((r) => ({
          label: r.username, value: `${r.bets} bet${r.bets === 1 ? '' : 's'}`,
          sub: `${r.plan === 'pro' ? 'Pro · ' : ''}joined ${ago_iso(r.created_at)}${r.seen ? ' · last seen ' + ago(r.seen) : ' · never seen'}` })) },
      ],
    };
  },

  active(win) {
    const { now, since } = win;
    const series = all(`SELECT ${tsBucket(win)} d, COUNT(DISTINCT user_id) v FROM analytics_events WHERE user_id IS NOT NULL AND ts >= ? GROUP BY d`, since);
    const au = (ms) => one('SELECT COUNT(DISTINCT user_id) n FROM analytics_events WHERE user_id IS NOT NULL AND ts >= ?', ms).n;
    const top = all(
      `SELECT u.username, COUNT(*) events, MAX(e.ts) seen,
              (SELECT COUNT(*) FROM bets b WHERE b.user_id = u.id) bets
         FROM analytics_events e JOIN users u ON u.id = e.user_id
        WHERE e.ts >= ? GROUP BY u.id ORDER BY events DESC LIMIT 15`, since);
    return {
      title: 'Active users',
      summary: [
        { label: 'Today', value: au(win.todayMs) },
        { label: '7 days', value: au(now - 7 * DAY) },
        { label: '30 days', value: au(now - 30 * DAY) },
      ],
      series: { label: win.today ? 'Active users per hour' : 'Active users per day', hourly: win.today, data: fillWindow(win, series) },
      lists: [
        { title: `Most active · ${win.label}`, rows: top.map((r) => ({
          label: r.username, value: `${r.events} actions`, sub: `${r.bets} bets · last seen ${ago(r.seen)}` })) },
      ],
    };
  },

  retention() {
    const now = Date.now();
    const weeks = all(
      `SELECT date(substr(created_at, 1, 10), '-6 days', 'weekday 1') wk, COUNT(*) signed,
              SUM(CASE WHEN EXISTS (SELECT 1 FROM analytics_events e WHERE e.user_id = users.id AND e.ts >= ?) THEN 1 ELSE 0 END) active
         FROM users GROUP BY wk ORDER BY wk DESC LIMIT 8`, now - 7 * DAY);
    const totalSigned = weeks.reduce((s, w) => s + w.signed, 0);
    const totalActive = weeks.reduce((s, w) => s + w.active, 0);
    return {
      title: 'Did they come back?',
      summary: [
        { label: 'Active this week', value: totalActive },
        { label: 'Signed up (last 8 weeks)', value: totalSigned },
        { label: 'Rate', value: pctStr(totalActive, totalSigned) },
      ],
      lists: [
        { title: 'By signup week (still active in the last 7 days)', rows: weeks.map((w) => ({
          label: `Week of ${new Date(w.wk + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
          value: pctStr(w.active, w.signed), sub: `${w.active} of ${w.signed} signed up` })) },
      ],
    };
  },

  pro() {
    const total = one('SELECT COUNT(*) n FROM users').n;
    const pro = one("SELECT COUNT(*) n FROM users WHERE plan = 'pro'").n;
    const proUsers = all(
      `SELECT u.username, u.created_at, (SELECT COUNT(*) FROM bets b WHERE b.user_id = u.id) bets
         FROM users u WHERE u.plan = 'pro' ORDER BY u.created_at DESC LIMIT 25`);
    const heavyFree = all(
      `SELECT u.username, COUNT(*) bets FROM users u JOIN bets b ON b.user_id = u.id
        WHERE u.plan != 'pro' GROUP BY u.id ORDER BY bets DESC LIMIT 10`);
    return {
      title: 'Pro conversion',
      summary: [
        { label: 'On Pro', value: pro }, { label: 'Free', value: total - pro },
        { label: 'Conversion', value: pctStr(pro, total) },
      ],
      lists: [
        { title: 'Pro accounts', rows: proUsers.map((r) => ({ label: r.username, value: `${r.bets} bets`, sub: `joined ${ago_iso(r.created_at)}` })) },
        { title: 'Heaviest free users (likeliest to upgrade)', rows: heavyFree.map((r) => ({ label: r.username, value: `${r.bets} bets` })) },
      ],
    };
  },

  bets(win) {
    const { sinceIso } = win;
    const series = all(`SELECT ${isoBucket(win)} d, COUNT(*) v FROM bets WHERE created_at >= ? GROUP BY d`, sinceIso);
    return {
      title: 'Bets logged',
      summary: [
        { label: 'Today', value: one('SELECT COUNT(*) n FROM bets WHERE created_at >= ?', new Date(win.todayMs).toISOString()).n },
        ...(win.today ? [] : [{ label: `${win.days} days`, value: one('SELECT COUNT(*) n FROM bets WHERE created_at >= ?', sinceIso).n }]),
        { label: 'All time', value: one('SELECT COUNT(*) n FROM bets').n },
      ],
      series: { label: win.today ? 'Bets logged per hour' : 'Bets logged per day', hourly: win.today, data: fillWindow(win, series) },
      lists: [
        { title: `Sports · ${win.label}`, rows: all(
          `SELECT COALESCE(NULLIF(sport, ''), 'No sport') label, COUNT(*) value FROM bets
            WHERE created_at >= ? GROUP BY label ORDER BY value DESC LIMIT 10`, sinceIso) },
        { title: `Bookmakers · ${win.label}`, rows: all(
          `SELECT COALESCE(NULLIF(bookmaker, ''), 'No bookmaker') label, COUNT(*) value FROM bets
            WHERE created_at >= ? GROUP BY label ORDER BY value DESC LIMIT 10`, sinceIso) },
        { title: `Who is logging most · ${win.label}`, rows: all(
          `SELECT u.username label, COUNT(*) value FROM bets b JOIN users u ON u.id = b.user_id
            WHERE b.created_at >= ? GROUP BY u.id ORDER BY value DESC LIMIT 10`, sinceIso) },
      ],
    };
  },

  scans() {
    const m = MONTH_KEY();
    const top = all(
      `SELECT username label, scan_count value, plan FROM users
        WHERE scan_month = ? AND scan_count > 0 ORDER BY scan_count DESC LIMIT 15`, m);
    return {
      title: 'AI scans this month',
      summary: [
        { label: 'Scans', value: one('SELECT COALESCE(SUM(scan_count), 0) n FROM users WHERE scan_month = ?', m).n },
        { label: 'People scanning', value: top.length >= 15 ? '15+' : top.length },
        { label: 'On free plan', value: one("SELECT COUNT(*) n FROM users WHERE scan_month = ? AND scan_count > 0 AND plan != 'pro'", m).n },
      ],
      lists: [{ title: 'Most scans', rows: top.map((r) => ({ label: r.label, value: r.value, sub: r.plan === 'pro' ? 'Pro' : 'Free' })) }],
    };
  },

  shares() {
    const rows = all(
      `SELECT u.username, s.created_at FROM shares s JOIN users u ON u.id = s.user_id
        ORDER BY s.created_at DESC LIMIT 20`);
    return {
      title: 'Public records shared',
      summary: [{ label: 'Shared records', value: one('SELECT COUNT(*) n FROM shares').n }],
      lists: [{ title: 'Latest', rows: rows.map((r) => ({ label: r.username, value: ago_iso(r.created_at) })) }],
    };
  },

  session(win) {
    const { since } = win;
    const sess = all(
      `SELECT ${tsBucket(win, 'MIN(ts)')} d, (MAX(ts) - MIN(ts)) / 1000 sec FROM analytics_events
        WHERE ts >= ? GROUP BY session_id`, since);
    const buckets = [['Under 10s', 0, 10], ['10–60s', 10, 60], ['1–5 min', 60, 300], ['5–15 min', 300, 900], ['15 min +', 900, Infinity]];
    const byDay = new Map();
    for (const r of sess) { const x = byDay.get(r.d) || { t: 0, n: 0 }; x.t += r.sec; x.n++; byDay.set(r.d, x); }
    const series = [...byDay.entries()].map(([d, x]) => ({ d, v: Math.round(x.t / x.n) }));
    const avg = sess.length ? Math.round(sess.reduce((t, r) => t + r.sec, 0) / sess.length) : 0;
    const sorted = sess.map((r) => r.sec).sort((a, b) => a - b);
    return {
      title: 'Time on app',
      summary: [
        { label: 'Average visit', value: `${Math.floor(avg / 60)}m ${avg % 60}s` },
        { label: 'Typical (median)', value: `${Math.floor((sorted[Math.floor(sorted.length / 2)] || 0) / 60)}m ${(sorted[Math.floor(sorted.length / 2)] || 0) % 60}s` },
        { label: 'Visits', value: sess.length },
      ],
      series: { label: win.today ? 'Average visit length per hour (seconds)' : 'Average visit length per day (seconds)', unit: 's', hourly: win.today, data: fillWindow(win, series) },
      lists: [{ title: 'How long visits last', rows: buckets.map(([label, lo, hi]) => ({
        label, value: sess.filter((r) => r.sec >= lo && r.sec < hi).length })) }],
    };
  },
};

router.get('/detail', (req, res) => {
  const fn = DETAILS[String(req.query.metric || '')];
  if (!fn) return res.status(400).json({ error: 'Unknown metric' });
  try {
    res.json(fn(windowOf(req)));
  } catch (e) {
    console.error('admin detail failed', e);
    res.status(500).json({ error: 'Could not load that breakdown' });
  }
});

export default router;
