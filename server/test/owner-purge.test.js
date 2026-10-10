import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

process.env.DB_PATH = path.join(os.tmpdir(), `owner-purge-${Date.now()}.db`);
process.env.ADMIN_EMAILS = 'Owner@Example.com';

test('purging removes every event from a browser the owner has used, and nobody else\'s', async () => {
  const { db } = await import('../src/lib/db.js');
  const { purgeOwnerTraffic } = await import('../src/routes/track.js');
  const user = (id, email) => db.prepare('INSERT INTO users (id,email,username,password,created_at) VALUES (?,?,?,?,?)').run(id, email, id, 'x', '2026-01-01');
  user('o1', 'owner@example.com'); user('u1', 'someone@example.com');
  const ev = db.prepare('INSERT INTO analytics_events (ts, session_id, user_id, path, kind) VALUES (?, ?, ?, ?, ?)');
  const now = Date.now();
  ev.run(now, 'owner-phone', null, '/', 'view');       // owner's phone, logged out
  ev.run(now, 'owner-phone', 'o1', '/admin', 'view');   // same phone, signed in as the owner
  ev.run(now, 'stranger', null, '/', 'view');
  ev.run(now, 'friend', 'u1', '/bets', 'view');
  assert.equal(purgeOwnerTraffic(), 2);
  const left = db.prepare('SELECT session_id FROM analytics_events ORDER BY session_id').all().map((r) => r.session_id);
  assert.deepEqual(left, ['friend', 'stranger']);
  assert.equal(purgeOwnerTraffic(), 0, 'safe to run again');
});
