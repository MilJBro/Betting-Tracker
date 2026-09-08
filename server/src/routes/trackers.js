import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { isPro } from '../lib/plan.js';
import { listTrackers, getTracker, createTracker, countTrackers, ensureDefaultTracker } from '../lib/trackers.js';

const router = Router();
router.use(requireAuth);

// List the user's trackers (ensures at least one exists).
router.get('/', (req, res) => {
  ensureDefaultTracker(req.userId);
  res.json({ trackers: listTrackers(req.userId), pro: isPro(req.userId) });
});

// Create a tracker. Multiple trackers are a Pro feature — free accounts keep one.
router.post('/', (req, res) => {
  if (!isPro(req.userId) && countTrackers(req.userId) >= 1) {
    return res.status(402).json({
      error: 'Multiple trackers is a Pro feature. Upgrade to run separate trackers.',
      upgrade: true,
    });
  }
  const name = String((req.body || {}).name || '').trim() || 'New tracker';
  const bankroll = Number((req.body || {}).bankroll_start) || 0;
  const tracker = createTracker(req.userId, name.slice(0, 60), bankroll);
  res.status(201).json({ tracker });
});

// Rename a tracker / set its bankroll.
router.put('/:id', (req, res) => {
  const t = getTracker(req.userId, req.params.id);
  if (!t) return res.status(404).json({ error: 'Tracker not found' });
  const name = req.body?.name != null ? String(req.body.name).trim().slice(0, 60) || t.name : t.name;
  const bankroll = req.body?.bankroll_start != null ? Number(req.body.bankroll_start) || 0 : t.bankroll_start;
  db.prepare('UPDATE trackers SET name = ?, bankroll_start = ? WHERE id = ? AND user_id = ?')
    .run(name, bankroll, t.id, req.userId);
  res.json({ tracker: getTracker(req.userId, t.id) });
});

// Delete a tracker and its bets. Refuse to remove the last one.
router.delete('/:id', (req, res) => {
  const t = getTracker(req.userId, req.params.id);
  if (!t) return res.status(404).json({ error: 'Tracker not found' });
  if (countTrackers(req.userId) <= 1) {
    return res.status(400).json({ error: 'You need at least one tracker.' });
  }
  db.prepare('DELETE FROM bets WHERE tracker_id = ? AND user_id = ?').run(t.id, req.userId);
  db.prepare('DELETE FROM trackers WHERE id = ? AND user_id = ?').run(t.id, req.userId);
  res.json({ ok: true });
});

export default router;
