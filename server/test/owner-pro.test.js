import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

process.env.DB_PATH = path.join(os.tmpdir(), `owner-pro-${Date.now()}.db`);
process.env.ADMIN_EMAILS = 'Owner@Example.com';

test('owner accounts are always Pro; others follow their stored plan', async () => {
  const { db } = await import('../src/lib/db.js');
  const { entitlements, isPro } = await import('../src/lib/plan.js');
  const add = (id, email, plan) => db.prepare('INSERT INTO users (id,email,username,password,created_at,plan) VALUES (?,?,?,?,?,?)').run(id, email, id, 'x', '2026-01-01', plan);
  add('o1', 'owner@example.com', 'free');
  add('u1', 'user@example.com', 'free');
  add('p1', 'paid@example.com', 'pro');
  assert.equal(isPro('o1'), true);
  assert.equal(entitlements('o1').comped, true);
  assert.equal(entitlements('o1').scans.unlimited, true);
  assert.equal(isPro('u1'), false);
  assert.equal(entitlements('u1').comped, false);
  assert.equal(isPro('p1'), true);
  assert.equal(entitlements('p1').comped, false);
  // A lapsed subscription can't take Pro from an owner.
  db.prepare("UPDATE users SET plan='free' WHERE id='o1'").run();
  assert.equal(isPro('o1'), true);
});
