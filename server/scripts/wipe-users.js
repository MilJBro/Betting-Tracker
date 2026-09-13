// One-off maintenance script: permanently delete EVERY account and all of its
// data (bets, settings, trackers, shares cascade via ON DELETE CASCADE).
//
// This is irreversible. It refuses to run unless CONFIRM=WIPE is set, so it
// can't fire by accident. It opens the same database the server uses (DB_PATH),
// so run it in the Render Shell where DB_PATH points at the production disk:
//
//     cd server && CONFIRM=WIPE node scripts/wipe-users.js
//
// After it runs, the app is a clean slate — anyone can register fresh.
import { db } from '../src/lib/db.js';

if (process.env.CONFIRM !== 'WIPE') {
  console.error(
    'Refusing to run: this permanently deletes every account and all their data.\n' +
    'Re-run with CONFIRM=WIPE to proceed, e.g.  CONFIRM=WIPE node scripts/wipe-users.js'
  );
  process.exit(1);
}

db.pragma('foreign_keys = ON'); // ensure the cascades fire

const before = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
const betsBefore = db.prepare('SELECT COUNT(*) AS n FROM bets').get().n;

const info = db.prepare('DELETE FROM users').run(); // cascades to settings/bets/trackers/shares

const usersAfter = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
const betsAfter = db.prepare('SELECT COUNT(*) AS n FROM bets').get().n;

console.log(
  `Deleted ${info.changes} account(s). ` +
  `Users: ${before} -> ${usersAfter}. Bets: ${betsBefore} -> ${betsAfter}.`
);
if (usersAfter !== 0 || betsAfter !== 0) {
  console.error('WARNING: some rows remain — check the database.');
  process.exit(1);
}
console.log('Database is now empty. New sign-ups will start fresh.');
