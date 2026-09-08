import Database from 'better-sqlite3';
import { join } from 'node:path';
import { config } from './config.js';

const dbPath = process.env.DB_PATH || join(config.dataDir, 'betting-tracker.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Schema -----------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  username      TEXT NOT NULL,
  password      TEXT NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 0,
  reset_token   TEXT,
  reset_expires TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bets (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  placed_at    TEXT NOT NULL,
  sport        TEXT,
  event        TEXT,
  selection    TEXT,
  bet_type     TEXT,
  bookmaker    TEXT,
  tipster      TEXT,
  stake        REAL NOT NULL DEFAULT 0,
  odds         REAL NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'pending',
  payout       REAL,
  notes        TEXT,
  tags         TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id, placed_at);

CREATE TABLE IF NOT EXISTS shares (
  public_id    TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shares_user ON shares(user_id);

-- A user can keep several separate trackers (e.g. one per tipster). Each owns
-- its own bets and its own bankroll.
CREATE TABLE IF NOT EXISTS trackers (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  bankroll_start REAL NOT NULL DEFAULT 0,
  position       INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trackers_user ON trackers(user_id);
`);

// --- Lightweight migrations -------------------------------------------------
// Add columns that may be missing on databases created by earlier versions.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('users', 'token_version', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'reset_token', 'TEXT');
ensureColumn('users', 'reset_expires', 'TEXT');
ensureColumn('bets', 'tipster', 'TEXT');
// Monetisation: subscription plan + monthly bet-slip scan usage.
ensureColumn('users', 'plan', "TEXT NOT NULL DEFAULT 'free'");
ensureColumn('users', 'scan_month', 'TEXT'); // 'YYYY-MM' of the current window
ensureColumn('users', 'scan_count', 'INTEGER NOT NULL DEFAULT 0');
// Multiple trackers: each bet belongs to a tracker; a share targets one.
ensureColumn('bets', 'tracker_id', 'TEXT');
ensureColumn('shares', 'tracker_id', 'TEXT');

// --- One-off data migration: give every user a default tracker and adopt any
// bets that predate trackers. Idempotent — safe to run on every boot.
const usersNeedingTracker = db
  .prepare(
    `SELECT u.id AS uid, s.data AS settings
       FROM users u
       LEFT JOIN settings s ON s.user_id = u.id
      WHERE NOT EXISTS (SELECT 1 FROM trackers t WHERE t.user_id = u.id)`
  )
  .all();
const makeId = () => 't' + Math.random().toString(36).slice(2, 12);
const nowIso = () => new Date().toISOString();
for (const row of usersNeedingTracker) {
  let bankroll = 0;
  try { bankroll = Number(JSON.parse(row.settings || '{}')?.bankroll?.starting) || 0; } catch {}
  const tid = makeId();
  db.prepare(
    'INSERT INTO trackers (id, user_id, name, bankroll_start, position, created_at) VALUES (?, ?, ?, ?, 0, ?)'
  ).run(tid, row.uid, 'My bets', bankroll, nowIso());
  db.prepare('UPDATE bets SET tracker_id = ? WHERE user_id = ? AND (tracker_id IS NULL OR tracker_id = ?)').run(tid, row.uid, '');
}
// Adopt any still-orphaned bets (e.g. tracker existed but column was null).
const orphans = db.prepare('SELECT DISTINCT user_id FROM bets WHERE tracker_id IS NULL OR tracker_id = ?').all('');
for (const o of orphans) {
  const t = db.prepare('SELECT id FROM trackers WHERE user_id = ? ORDER BY position, created_at LIMIT 1').get(o.user_id);
  if (t) db.prepare('UPDATE bets SET tracker_id = ? WHERE user_id = ? AND (tracker_id IS NULL OR tracker_id = ?)').run(t.id, o.user_id, '');
}

export default db;
