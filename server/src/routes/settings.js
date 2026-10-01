import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { mergeSettings, DEFAULT_SETTINGS } from '../lib/defaults.js';
import { resolveStaking } from '../lib/units.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const row = db
    .prepare('SELECT data FROM settings WHERE user_id = ?')
    .get(req.userId);
  const saved = row ? JSON.parse(row.data) : null;
  res.json({ settings: mergeSettings(saved) });
});

router.put('/', (req, res) => {
  const incoming = req.body?.settings || req.body || {};
  const merged = mergeSettings(incoming);
  // The unit-size history is derived on the server from changes to unitSize.
  const row = db.prepare('SELECT data FROM settings WHERE user_id = ?').get(req.userId);
  const previous = mergeSettings(row ? JSON.parse(row.data) : null).staking;
  const hasBets = !!db.prepare('SELECT 1 FROM bets WHERE user_id = ? LIMIT 1').get(req.userId);
  merged.staking = resolveStaking(previous, incoming.staking, {
    hasBets,
    today: new Date().toISOString().slice(0, 10),
  });
  const payload = JSON.stringify(merged);
  db.prepare(
    `INSERT INTO settings (user_id, data) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data`
  ).run(req.userId, payload);
  res.json({ settings: merged });
});

router.post('/reset', (req, res) => {
  db.prepare(
    `INSERT INTO settings (user_id, data) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data`
  ).run(req.userId, JSON.stringify(DEFAULT_SETTINGS));
  res.json({ settings: mergeSettings(DEFAULT_SETTINGS) });
});

export default router;
