import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { isPro, requirePro } from '../lib/plan.js';
import { resolveTrackerId } from '../lib/trackers.js';
import { computeStats, computeAnalytics } from '../lib/stats.js';

const router = Router();
router.use(requireAuth);

const STATUSES = ['pending', 'won', 'lost', 'void', 'cashout'];

function rowToBet(row) {
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    legs: row.legs ? safeJson(row.legs, []) : [],
  };
}

function safeJson(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

// Normalise accumulator legs into a clean [{selection, odds}] array and drop
// empties. Returns [] for a single bet.
function cleanLegs(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => ({ selection: String(l?.selection || '').trim(), odds: Number(l?.odds) || 0 }))
    .filter((l) => l.selection || l.odds > 0);
}

function sanitise(body) {
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const status = STATUSES.includes(body.status) ? body.status : 'pending';

  // Accumulator: derive combined odds (product of legs) and a selection summary.
  const legs = cleanLegs(body.legs);
  const isAcca = legs.length >= 2;
  let odds = num(body.odds);
  let selection = (body.selection || '').trim();
  let bet_type = (body.bet_type || '').trim();
  if (isAcca) {
    odds = Number(legs.reduce((p, l) => p * (l.odds || 1), 1).toFixed(3));
    if (!selection) selection = legs.map((l) => l.selection).filter(Boolean).join(' / ');
    bet_type = 'Accumulator';
  }

  let payout = body.payout === '' || body.payout == null ? null : num(body.payout);
  // Auto-fill payout for a won bet if not supplied.
  if (status === 'won' && (payout == null || payout === 0)) {
    payout = Number((num(body.stake) * odds).toFixed(2));
  }
  if (status === 'lost') payout = 0;
  return {
    placed_at: body.placed_at || new Date().toISOString().slice(0, 10),
    sport: (body.sport || '').trim(),
    event: (body.event || '').trim(),
    selection,
    bet_type,
    bookmaker: (body.bookmaker || '').trim(),
    tipster: (body.tipster || '').trim(),
    stake: num(body.stake),
    odds,
    status,
    payout,
    notes: (body.notes || '').trim(),
    tags: JSON.stringify(Array.isArray(body.tags) ? body.tags : []),
    legs: JSON.stringify(legs),
  };
}

// List all bets for the current user's active tracker.
router.get('/', (req, res) => {
  const trackerId = resolveTrackerId(req.userId, req.query.tracker);
  const rows = db
    .prepare('SELECT * FROM bets WHERE user_id = ? AND tracker_id = ? ORDER BY placed_at DESC, created_at DESC')
    .all(req.userId, trackerId);
  res.json({ bets: rows.map(rowToBet), tracker: trackerId });
});

// Aggregate stats for the dashboard (scoped to the active tracker).
router.get('/stats', (req, res) => {
  const trackerId = resolveTrackerId(req.userId, req.query.tracker);
  const rows = db
    .prepare('SELECT * FROM bets WHERE user_id = ? AND tracker_id = ?')
    .all(req.userId, trackerId)
    .map(rowToBet);
  res.json({ stats: computeStats(rows) });
});

// Deeper analytics for the Insights page. Pro accounts may filter by date
// range, sport and tipster; free accounts always get the all-time view (the
// filter controls are Pro-gated on the client and ignored here for free users).
router.get('/analytics', (req, res) => {
  const trackerId = resolveTrackerId(req.userId, req.query.tracker);
  const all = db
    .prepare('SELECT * FROM bets WHERE user_id = ? AND tracker_id = ?')
    .all(req.userId, trackerId)
    .map(rowToBet);

  const pro = isPro(req.userId);
  const applied = {};
  let rows = all;
  if (pro) {
    const { from, to, sport, tipster } = req.query;
    if (from) { rows = rows.filter((b) => (b.placed_at || '') >= from); applied.from = String(from); }
    if (to) { rows = rows.filter((b) => (b.placed_at || '') <= to); applied.to = String(to); }
    if (sport) { rows = rows.filter((b) => (b.sport || '') === sport); applied.sport = String(sport); }
    if (tipster) { rows = rows.filter((b) => (b.tipster || '') === tipster); applied.tipster = String(tipster); }
  }

  const distinct = (key) => [...new Set(all.map((b) => b[key]).filter(Boolean))].sort();
  res.json({
    analytics: computeAnalytics(rows),
    pro,
    filters: applied,
    options: { sports: distinct('sport'), tipsters: distinct('tipster'), bookmakers: distinct('bookmaker') },
  });
});

router.post('/', (req, res) => {
  const b = sanitise(req.body || {});
  const id = nanoid();
  const now = new Date().toISOString();
  const trackerId = resolveTrackerId(req.userId, (req.body || {}).tracker_id || req.query.tracker);
  db.prepare(
    `INSERT INTO bets (id, user_id, tracker_id, placed_at, sport, event, selection, bet_type,
       bookmaker, tipster, stake, odds, status, payout, notes, tags, legs, created_at, updated_at)
     VALUES (@id, @user_id, @tracker_id, @placed_at, @sport, @event, @selection, @bet_type,
       @bookmaker, @tipster, @stake, @odds, @status, @payout, @notes, @tags, @legs, @created_at, @updated_at)`
  ).run({ id, user_id: req.userId, tracker_id: trackerId, ...b, created_at: now, updated_at: now });
  const row = db.prepare('SELECT * FROM bets WHERE id = ?').get(id);
  res.status(201).json({ bet: rowToBet(row) });
});

// Bulk-import bets (CSV upload, parsed client-side) into the active tracker.
// Pro-only: bringing an existing history across is a premium convenience.
const IMPORT_MAX = 5000;
router.post('/import', requirePro, (req, res) => {
  const list = Array.isArray((req.body || {}).bets) ? req.body.bets : null;
  if (!list) return res.status(400).json({ error: 'Expected a "bets" array.' });
  if (list.length === 0) return res.status(400).json({ error: 'No rows to import.' });
  if (list.length > IMPORT_MAX) {
    return res.status(400).json({ error: `Too many rows — import up to ${IMPORT_MAX} at a time.` });
  }
  const trackerId = resolveTrackerId(req.userId, (req.body || {}).tracker_id || req.query.tracker);
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO bets (id, user_id, tracker_id, placed_at, sport, event, selection, bet_type,
       bookmaker, tipster, stake, odds, status, payout, notes, tags, legs, created_at, updated_at)
     VALUES (@id, @user_id, @tracker_id, @placed_at, @sport, @event, @selection, @bet_type,
       @bookmaker, @tipster, @stake, @odds, @status, @payout, @notes, @tags, @legs, @created_at, @updated_at)`
  );
  const insertAll = db.transaction((rows) => {
    for (const raw of rows) {
      const b = sanitise(raw || {});
      stmt.run({ id: nanoid(), user_id: req.userId, tracker_id: trackerId, ...b, created_at: now, updated_at: now });
    }
  });
  insertAll(list);
  res.status(201).json({ imported: list.length, tracker: trackerId });
});

router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM bets WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Bet not found' });
  const b = sanitise({ ...rowToBet(existing), ...req.body });
  db.prepare(
    `UPDATE bets SET placed_at=@placed_at, sport=@sport, event=@event,
       selection=@selection, bet_type=@bet_type, bookmaker=@bookmaker,
       tipster=@tipster, stake=@stake, odds=@odds, status=@status, payout=@payout,
       notes=@notes, tags=@tags, legs=@legs, updated_at=@updated_at WHERE id=@id AND user_id=@user_id`
  ).run({
    ...b,
    id: req.params.id,
    user_id: req.userId,
    updated_at: new Date().toISOString(),
  });
  const row = db.prepare('SELECT * FROM bets WHERE id = ?').get(req.params.id);
  res.json({ bet: rowToBet(row) });
});

router.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM bets WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Bet not found' });
  res.json({ ok: true });
});

export default router;
