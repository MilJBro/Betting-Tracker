import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { computeStats, computeAnalytics } from '../lib/stats.js';

const router = Router();
router.use(requireAuth);

const STATUSES = ['pending', 'won', 'lost', 'void', 'cashout'];

function rowToBet(row) {
  return { ...row, tags: row.tags ? JSON.parse(row.tags) : [] };
}

function sanitise(body) {
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const status = STATUSES.includes(body.status) ? body.status : 'pending';
  let payout = body.payout === '' || body.payout == null ? null : num(body.payout);
  // Auto-fill payout for a won bet if not supplied.
  if (status === 'won' && (payout == null || payout === 0)) {
    payout = Number((num(body.stake) * num(body.odds)).toFixed(2));
  }
  if (status === 'lost') payout = 0;
  return {
    placed_at: body.placed_at || new Date().toISOString().slice(0, 10),
    sport: (body.sport || '').trim(),
    event: (body.event || '').trim(),
    selection: (body.selection || '').trim(),
    bet_type: (body.bet_type || '').trim(),
    bookmaker: (body.bookmaker || '').trim(),
    stake: num(body.stake),
    odds: num(body.odds),
    status,
    payout,
    notes: (body.notes || '').trim(),
    tags: JSON.stringify(Array.isArray(body.tags) ? body.tags : []),
  };
}

// List all bets for the current user.
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM bets WHERE user_id = ? ORDER BY placed_at DESC, created_at DESC')
    .all(req.userId);
  res.json({ bets: rows.map(rowToBet) });
});

// Aggregate stats for the dashboard.
router.get('/stats', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM bets WHERE user_id = ?')
    .all(req.userId)
    .map(rowToBet);
  res.json({ stats: computeStats(rows) });
});

// Deeper analytics for the Insights page.
router.get('/analytics', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM bets WHERE user_id = ?')
    .all(req.userId)
    .map(rowToBet);
  res.json({ analytics: computeAnalytics(rows) });
});

router.post('/', (req, res) => {
  const b = sanitise(req.body || {});
  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO bets (id, user_id, placed_at, sport, event, selection, bet_type,
       bookmaker, stake, odds, status, payout, notes, tags, created_at, updated_at)
     VALUES (@id, @user_id, @placed_at, @sport, @event, @selection, @bet_type,
       @bookmaker, @stake, @odds, @status, @payout, @notes, @tags, @created_at, @updated_at)`
  ).run({ id, user_id: req.userId, ...b, created_at: now, updated_at: now });
  const row = db.prepare('SELECT * FROM bets WHERE id = ?').get(id);
  res.status(201).json({ bet: rowToBet(row) });
});

router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM bets WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Bet not found' });
  const b = sanitise({ ...existing, ...req.body });
  db.prepare(
    `UPDATE bets SET placed_at=@placed_at, sport=@sport, event=@event,
       selection=@selection, bet_type=@bet_type, bookmaker=@bookmaker,
       stake=@stake, odds=@odds, status=@status, payout=@payout, notes=@notes,
       tags=@tags, updated_at=@updated_at WHERE id=@id AND user_id=@user_id`
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
