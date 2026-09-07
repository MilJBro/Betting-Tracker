import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH || join(dataDir, 'betting-tracker.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Schema -----------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  username     TEXT NOT NULL,
  password     TEXT NOT NULL,
  created_at   TEXT NOT NULL
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

export default db;
