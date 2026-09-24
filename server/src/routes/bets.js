import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { isPro, requirePro } from '../lib/plan.js';
import { resolveTrackerId } from '../lib/trackers.js';
import { computeStats, computeAnalytics } from '../lib/stats.js';

const router = Router();
router.use(requireAuth);

const STATUSES = ['pending', 'won', 'lost', 'void', 'cashout', 'placed'];

function rowToBet(row) {
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    legs: row.legs ? safeJson(row.legs, []) : [],
    each_way: !!row.each_way,
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

  // Multi-selection bets carry their picks in `legs`.
  //  · Accumulator: selections from different games — combined odds are the
  //    product of each leg's odds.
  //  · Bet builder: selections within the SAME game, priced by the bookmaker as
  //    one combined price, so we keep the odds the user entered.
  const legs = cleanLegs(body.legs);
  const requestedType = (body.bet_type || '').trim();
  const isBuilder = requestedType === 'Bet builder' && legs.length >= 2;
  const isAcca = !isBuilder && legs.length >= 2;
  let odds = num(body.odds);
  let selection = (body.selection || '').trim();
  let bet_type = requestedType;
  if (isAcca) {
    odds = Number(legs.reduce((p, l) => p * (l.odds || 1), 1).toFixed(3));
    if (!selection) selection = legs.map((l) => l.selection).filter(Boolean).join(' / ');
    bet_type = 'Accumulator';
  } else if (isBuilder) {
    // Odds stay as the single combined price the user entered.
    if (!selection) selection = legs.map((l) => l.selection).filter(Boolean).join(' / ');
    bet_type = 'Bet builder';
  }

  // Each-way: total outlay (Win + Place) is stored in `stake`. The client
  // computes the each-way return and sends it as `payout`, so we don't try to
  // second-guess it here — we only auto-fill the simple win = stake × odds case.
  const eachWay = !!body.each_way;
  const ewFraction = eachWay ? (String(body.ew_fraction || '').trim() || '1/5') : null;
  const ewPlaces = eachWay && body.ew_places !== '' && body.ew_places != null ? Math.max(0, Math.round(num(body.ew_places))) : null;
  // Winnings boost fraction (e.g. 0.25). Clamp to a sane 0–5 (0–500%).
  const boost = Math.min(5, Math.max(0, num(body.boost)));

  let payout = body.payout === '' || body.payout == null ? null : num(body.payout);
  // Auto-fill payout for a plain (non-each-way) won bet if not supplied, adding
  // any winnings boost to the profit part (stake back unchanged).
  if (!eachWay && status === 'won' && (payout == null || payout === 0)) {
    const stakeN = num(body.stake);
    payout = Number((stakeN + (stakeN * odds - stakeN) * (1 + boost)).toFixed(2));
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
    notes: '', // notes were removed as a feature — never stored anymore
    tags: JSON.stringify(Array.isArray(body.tags) ? body.tags : []),
    legs: JSON.stringify(legs),
    each_way: eachWay ? 1 : 0,
    ew_fraction: ewFraction,
    ew_places: ewPlaces,
    boost,
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

// Deeper analytics (the Performance page) is a Pro feature — the dashboard's
// headline numbers (net profit, ROI, win rate, chart) stay free via /stats.
// Free accounts get a locked response so the client can show the upgrade wall.
router.get('/analytics', (req, res) => {
  const pro = isPro(req.userId);
  if (!pro) return res.json({ pro: false, locked: true });

  const trackerId = resolveTrackerId(req.userId, req.query.tracker);
  const all = db
    .prepare('SELECT * FROM bets WHERE user_id = ? AND tracker_id = ?')
    .all(req.userId, trackerId)
    .map(rowToBet);

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
       bookmaker, tipster, stake, odds, status, payout, notes, tags, legs, each_way, ew_fraction, ew_places, boost, created_at, updated_at)
     VALUES (@id, @user_id, @tracker_id, @placed_at, @sport, @event, @selection, @bet_type,
       @bookmaker, @tipster, @stake, @odds, @status, @payout, @notes, @tags, @legs, @each_way, @ew_fraction, @ew_places, @boost, @created_at, @updated_at)`
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
       bookmaker, tipster, stake, odds, status, payout, notes, tags, legs, each_way, ew_fraction, ew_places, boost, created_at, updated_at)
     VALUES (@id, @user_id, @tracker_id, @placed_at, @sport, @event, @selection, @bet_type,
       @bookmaker, @tipster, @stake, @odds, @status, @payout, @notes, @tags, @legs, @each_way, @ew_fraction, @ew_places, @boost, @created_at, @updated_at)`
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
       notes=@notes, tags=@tags, legs=@legs, each_way=@each_way, ew_fraction=@ew_fraction,
       ew_places=@ew_places, boost=@boost, updated_at=@updated_at WHERE id=@id AND user_id=@user_id`
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
