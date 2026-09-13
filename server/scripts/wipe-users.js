// One-off maintenance script: permanently delete EVERY account and all of its
// data (bets, settings, trackers, shares cascade via ON DELETE CASCADE).
//
// It does NOT trust a single path — it finds every SQLite database on the disk
// and reports how many accounts each holds, so we can be sure we're hitting the
// real one. It only DELETES when CONFIRM=WIPE is set; otherwise it's a dry run.
//
//   Dry run (just show the databases + counts):
//     node server/scripts/wipe-users.js
//   Actually wipe every account from every DB that has them:
//     CONFIRM=WIPE node server/scripts/wipe-users.js
//
// This is irreversible.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const CONFIRM = process.env.CONFIRM === 'WIPE';

// Build the list of database files to inspect: the configured DB_PATH, the
// known production paths, and anything ending in .db under the data dirs.
const candidates = [];
const add = (p) => { if (p && !candidates.includes(p)) candidates.push(p); };

add(process.env.DB_PATH);
add('/var/data/betbooks.db');
add('/var/data/betting-tracker.db');
for (const dir of ['/var/data', path.resolve('server/data'), path.resolve('data'), path.resolve('.')]) {
  try {
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.db')) add(path.join(dir, f));
  } catch { /* dir may not exist */ }
}

console.log(CONFIRM ? 'MODE: WIPE (deleting)\n' : 'MODE: dry run (no changes)\n');
console.log('Databases found:');

let wipedAny = false;
for (const p of candidates) {
  if (!fs.existsSync(p)) continue;
  let db;
  try {
    db = new Database(p);
    db.pragma('foreign_keys = ON');
  } catch (e) {
    console.log(`  - ${p}: cannot open (${e.message})`);
    continue;
  }
  let users;
  try {
    users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  } catch {
    db.close();
    continue; // not one of our databases
  }
  const bets = db.prepare('SELECT COUNT(*) AS n FROM bets').get().n;
  console.log(`  - ${p}: ${users} account(s), ${bets} bet(s)`);
  if (CONFIRM && users > 0) {
    db.prepare('DELETE FROM users').run(); // cascades to settings/bets/trackers/shares
    const after = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    console.log(`        -> deleted; now ${after} account(s)`);
    wipedAny = true;
  }
  db.close();
}

if (!CONFIRM) {
  console.log('\nThis was a DRY RUN. To delete every account from the database(s) above, run:');
  console.log('  CONFIRM=WIPE node server/scripts/wipe-users.js');
} else if (wipedAny) {
  console.log('\nDone. Every account was deleted — sign-ups will start fresh.');
} else {
  console.log('\nNo accounts found to delete in any database.');
}
