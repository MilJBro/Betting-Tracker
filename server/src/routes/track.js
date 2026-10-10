import { Router } from 'express';
import { db } from '../lib/db.js';
import { optionalAuth } from '../lib/auth.js';
import { cleanSource } from '../lib/source.js';
import { isAdmin } from '../lib/admin.js';
import { config } from '../lib/config.js';

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

// The site owner's own visits would skew every Insights number, so they're not
// recorded (see the beacon below), and any already on file are removed. Owners
// are the accounts in ADMIN_EMAILS; a browser that was ever signed in as one is
// treated as theirs, so their logged-out visits on it go too. Safe to repeat.
export function purgeOwnerTraffic() {
  const emails = config.adminEmails;
  if (!emails.length) return 0;
  const marks = emails.map(() => '?').join(',');
  return db.prepare(
    `DELETE FROM analytics_events WHERE session_id IN (
       SELECT DISTINCT session_id FROM analytics_events
        WHERE user_id IN (SELECT id FROM users WHERE lower(email) IN (${marks})))`
  ).run(...emails).changes;
}
try { purgeOwnerTraffic(); } catch { /* never block startup */ }

// Owner check per beacon is cheap but frequent (a heartbeat per open tab), so
// remember the answer for a minute.
const ownerCache = new Map();
function isOwner(userId) {
  const hit = ownerCache.get(userId);
  if (hit && hit.until > Date.now()) return hit.owner;
  const owner = isAdmin(userId);
  ownerCache.set(userId, { owner, until: Date.now() + 60000 });
  return owner;
}

const KINDS = new Set(['view', 'ping']);
const insert = db.prepare(
  'INSERT INTO analytics_events (ts, session_id, user_id, path, kind, country, source) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

// Cloudflare adds cf-ipcountry (a 2-letter ISO code) to origin requests. Ignore
// its unknown/special markers ("XX" unknown, "T1" Tor) and anything malformed.
function cleanCountry(header) {
  if (typeof header !== 'string') return null;
  const c = header.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c) || c === 'XX' || c === 'T1') return null;
  return c;
}

// Fire-and-forget usage beacon. Always responds 200 so a tracking failure never
// affects the app; attaches the signed-in user when a token is present.
router.post('/', optionalAuth, (req, res) => {
  const { sid, path, kind, ref, host } = req.body || {};
  if (sid && typeof sid === 'string' && !(req.userId && isOwner(req.userId))) {
    const k = KINDS.has(kind) ? kind : 'view';
    const country = cleanCountry(req.headers['cf-ipcountry']);
    try {
      insert.run(Date.now(), sid.slice(0, 40), req.userId || null, cleanPath(path), k, country, cleanSource(ref, host));
    } catch {
      /* ignore — never surface tracking errors */
    }
  }
  res.json({ ok: true });
});

export default router;
