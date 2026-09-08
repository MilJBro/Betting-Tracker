import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { mergeSettings } from '../lib/defaults.js';
import { computeStats } from '../lib/stats.js';
import { resolveTrackerId, getTracker } from '../lib/trackers.js';

const router = Router();

// --- Authenticated: manage your own share link ------------------------------
router.get('/me', requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT public_id, enabled, tracker_id FROM shares WHERE user_id = ?')
    .get(req.userId);
  if (!row) return res.json({ share: null });
  res.json({ share: { publicId: row.public_id, enabled: !!row.enabled, trackerId: row.tracker_id } });
});

// Enable sharing (creates a link if one doesn't exist yet). The share targets
// one tracker — the active one, or the user's default.
router.post('/enable', requireAuth, (req, res) => {
  const trackerId = resolveTrackerId(req.userId, (req.body || {}).tracker_id);
  let row = db
    .prepare('SELECT public_id FROM shares WHERE user_id = ?')
    .get(req.userId);
  if (row) {
    db.prepare('UPDATE shares SET enabled = 1, tracker_id = ? WHERE user_id = ?').run(trackerId, req.userId);
  } else {
    const publicId = nanoid(10);
    db.prepare(
      'INSERT INTO shares (public_id, user_id, enabled, tracker_id, created_at) VALUES (?, ?, 1, ?, ?)'
    ).run(publicId, req.userId, trackerId, new Date().toISOString());
    row = { public_id: publicId };
  }
  res.json({ share: { publicId: row.public_id, enabled: true, trackerId } });
});

router.post('/disable', requireAuth, (req, res) => {
  db.prepare('UPDATE shares SET enabled = 0 WHERE user_id = ?').run(req.userId);
  res.json({ ok: true });
});

// --- Public: view a shared profile (no auth) --------------------------------
router.get('/public/:publicId', (req, res) => {
  const share = db
    .prepare('SELECT * FROM shares WHERE public_id = ? AND enabled = 1')
    .get(req.params.publicId);
  if (!share)
    return res.status(404).json({ error: 'This share link is not available' });

  const user = db
    .prepare('SELECT username FROM users WHERE id = ?')
    .get(share.user_id);
  const settingsRow = db
    .prepare('SELECT data FROM settings WHERE user_id = ?')
    .get(share.user_id);
  const settings = mergeSettings(settingsRow ? JSON.parse(settingsRow.data) : null);
  const sharing = settings.sharing;

  // Scope to the shared tracker (fallback to the user's default for legacy shares).
  const trackerId = share.tracker_id || resolveTrackerId(share.user_id, null);
  const rows = db
    .prepare('SELECT * FROM bets WHERE user_id = ? AND tracker_id = ?')
    .all(share.user_id, trackerId)
    .map((r) => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : [] }));
  const stats = computeStats(rows);

  // Only reveal what the user opted into sharing.
  const publicStats = {
    totalBets: stats.totalBets,
    winRate: sharing.showWinRate ? stats.winRate : null,
    roi: sharing.showRoi ? stats.roi : null,
    netProfit: sharing.showProfit ? stats.netProfit : null,
    totalStaked: sharing.showStakes ? stats.totalStaked : null,
    timeline: sharing.showProfit ? stats.timeline : [],
    sportBreakdown: stats.sportBreakdown.map((s) => ({
      sport: s.sport,
      bets: s.bets,
      profit: sharing.showProfit ? s.profit : null,
      roi: sharing.showRoi ? s.roi : null,
    })),
  };

  const recent = sharing.showRecentBets
    ? rows
        .sort((a, b) => new Date(b.placed_at) - new Date(a.placed_at))
        .slice(0, 10)
        .map((b) => ({
          placed_at: b.placed_at,
          sport: b.sport,
          selection: b.selection,
          odds: b.odds,
          status: b.status,
          stake: sharing.showStakes ? b.stake : null,
        }))
    : [];

  res.json({
    profile: {
      displayName: sharing.displayName || user?.username || 'Anonymous',
      theme: settings.theme,
      currency: settings.currency,
      staking: settings.staking,
      stats: publicStats,
      recent,
      reveal: {
        profit: sharing.showProfit,
        roi: sharing.showRoi,
        winRate: sharing.showWinRate,
        stakes: sharing.showStakes,
      },
    },
  });
});

export default router;
