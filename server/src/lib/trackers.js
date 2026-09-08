import { db } from './db.js';

const makeId = () => 't' + Math.random().toString(36).slice(2, 12);

export function listTrackers(userId) {
  return db
    .prepare('SELECT id, name, bankroll_start, position, created_at FROM trackers WHERE user_id = ? ORDER BY position, created_at')
    .all(userId);
}

export function getTracker(userId, id) {
  return db.prepare('SELECT * FROM trackers WHERE id = ? AND user_id = ?').get(id, userId);
}

export function countTrackers(userId) {
  return db.prepare('SELECT COUNT(*) AS c FROM trackers WHERE user_id = ?').get(userId).c;
}

// Guarantee the user has at least one tracker; return the first tracker's id.
export function ensureDefaultTracker(userId, name = 'My bets', bankrollStart = 0) {
  const existing = db
    .prepare('SELECT id FROM trackers WHERE user_id = ? ORDER BY position, created_at LIMIT 1')
    .get(userId);
  if (existing) return existing.id;
  const id = makeId();
  db.prepare(
    'INSERT INTO trackers (id, user_id, name, bankroll_start, position, created_at) VALUES (?, ?, ?, ?, 0, ?)'
  ).run(id, userId, name, Number(bankrollStart) || 0, new Date().toISOString());
  return id;
}

export function createTracker(userId, name, bankrollStart = 0) {
  const id = makeId();
  const pos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM trackers WHERE user_id = ?').get(userId).p;
  db.prepare(
    'INSERT INTO trackers (id, user_id, name, bankroll_start, position, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, userId, name, Number(bankrollStart) || 0, pos, new Date().toISOString());
  return getTracker(userId, id);
}

// Resolve which tracker a request targets: an explicit id (validated against
// the user), else the user's default tracker.
export function resolveTrackerId(userId, requested) {
  if (requested) {
    const t = getTracker(userId, requested);
    if (t) return t.id;
  }
  return ensureDefaultTracker(userId);
}
