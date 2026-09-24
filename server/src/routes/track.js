import { Router } from 'express';
import { db } from '../lib/db.js';
import { optionalAuth } from '../lib/auth.js';

const router = Router();

// Normalise paths so the table stays small and pages group sensibly. Dynamic
// segments (share links, blog slugs) collapse to a single bucket.
function cleanPath(p) {
  if (typeof p !== 'string' || !p) return '/';
  let s = p.split('?')[0].split('#')[0].trim() || '/';
  s = s
    .replace(/^\/share\/[^/]+.*$/, '/share/:id')
    .replace(/^\/blog\/[^/]+.*$/, '/blog/:slug')
    .replace(/^\/reset-password.*$/, '/reset-password');
  return s.slice(0, 120);
}

const KINDS = new Set(['view', 'ping']);
const insert = db.prepare(
  'INSERT INTO analytics_events (ts, session_id, user_id, path, kind) VALUES (?, ?, ?, ?, ?)'
);

// Fire-and-forget usage beacon. Always responds 200 so a tracking failure never
// affects the app; attaches the signed-in user when a token is present.
router.post('/', optionalAuth, (req, res) => {
  const { sid, path, kind } = req.body || {};
  if (sid && typeof sid === 'string') {
    const k = KINDS.has(kind) ? kind : 'view';
    try {
      insert.run(Date.now(), sid.slice(0, 40), req.userId || null, cleanPath(path), k);
    } catch {
      /* ignore — never surface tracking errors */
    }
  }
  res.json({ ok: true });
});

export default router;
