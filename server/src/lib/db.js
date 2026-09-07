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

export default db;
