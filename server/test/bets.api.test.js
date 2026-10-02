// Core bet flows through the real API: validation, settling, editing, isolation.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 5300 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'betbooks-bets-'));
let server, alice, bob;

const call = async (path, { method = 'GET', body, token } = {}) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const reg = async (n) => (await call('/api/auth/register', { method: 'POST', body: { email: `${n}@example.com`, username: n, password: 'correct-horse-9' } })).j.token;

before(async () => {
  server = spawn(process.execPath, ['src/index.js'], {
    env: { ...process.env, PORT: String(PORT), DB_PATH: join(dir, 't.db'), JWT_SECRET: 'test-secret-not-real-0123456789', NODE_ENV: 'development' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  alice = await reg('alice');
  bob = await reg('bobby');
});
after(() => { server?.kill(); rmSync(dir, { recursive: true, force: true }); });

const add = (b, token = alice) => call('/api/bets', { method: 'POST', token, body: b });

test('impossible stakes and prices are rejected, normal bets are not', async () => {
  assert.equal((await add({ selection: 'x', odds: 2, stake: -5 })).s, 400);
  assert.equal((await add({ selection: 'x', odds: 0.5, stake: 5 })).s, 400);
  assert.equal((await add({ selection: 'x', odds: 2, stake: 1e12 })).s, 400);
  assert.equal((await add({ selection: 'x', odds: 2, stake: 10 })).s, 201);
  assert.equal((await add({ selection: 'x', stake: 10 })).s, 201, 'blank odds still allowed (imports, voids)');
});

test('long text is trimmed and a junk date falls back to today', async () => {
  const r = await add({ selection: 'x'.repeat(5000), odds: 2, stake: 1, placed_at: 'not a date' });
  assert.equal(r.s, 201);
  assert.equal(r.j.bet.selection.length, 300);
  assert.match(r.j.bet.placed_at, /^\d{4}-\d{2}-\d{2}$/);
});

test('editing the stake of a won bet recomputes the return instead of keeping the old one', async () => {
  const b = (await add({ selection: 'w', odds: 2.5, stake: 10 })).j.bet;
  const won = await call('/api/bets/' + b.id, { method: 'PUT', token: alice, body: { status: 'won' } });
  assert.equal(won.j.bet.payout, 25);
  const edit = await call('/api/bets/' + b.id, { method: 'PUT', token: alice, body: { stake: 20 } });
  assert.equal(edit.j.bet.payout, 50);
  // an explicit return still wins
  const manual = await call('/api/bets/' + b.id, { method: 'PUT', token: alice, body: { stake: 20, payout: 41 } });
  assert.equal(manual.j.bet.payout, 41);
  // a cash-out keeps its amount when only the note-type fields change
  const c = (await add({ selection: 'c', odds: 3, stake: 10, status: 'cashout', payout: 14 })).j.bet;
  const ce = await call('/api/bets/' + c.id, { method: 'PUT', token: alice, body: { selection: 'c2' } });
  assert.equal(ce.j.bet.payout, 14);
});

test('accumulator odds multiply and a boost lifts the winnings', async () => {
  const acca = (await add({ bet_type: 'accumulator', stake: 5, legs: [{ selection: 'a', odds: 2 }, { selection: 'b', odds: 3 }, { selection: 'c', odds: 1.5 }] })).j.bet;
  assert.equal(acca.odds, 9);
  const boosted = (await add({ selection: 'b', odds: 3, stake: 10, boost: 0.5, status: 'won' })).j.bet;
  assert.equal(boosted.payout, 40); // 10 stake + 20 profit * 1.5
});

test('another account cannot read, edit, delete or inject into your bets', async () => {
  const b = (await add({ selection: 'mine', odds: 2, stake: 10 })).j.bet;
  assert.equal((await call('/api/bets', { token: bob })).j.bets.length, 0);
  assert.equal((await call('/api/bets/' + b.id, { method: 'PUT', token: bob, body: { stake: 1 } })).s, 404);
  assert.equal((await call('/api/bets/' + b.id, { method: 'DELETE', token: bob })).s, 404);
  const tracker = (await call('/api/trackers', { token: alice })).j;
  const tid = (tracker.trackers || tracker)[0].id;
  await add({ selection: 'sneaky', odds: 2, stake: 1, tracker_id: tid }, bob);
  assert.ok(!(await call('/api/bets', { token: alice })).j.bets.some((x) => x.selection === 'sneaky'));
  assert.equal((await call('/api/bets', { token: alice })).j.bets.find((x) => x.id === b.id).stake, 10);
});

test('free accounts cannot reach Pro endpoints or upgrade themselves', async () => {
  assert.equal((await call('/api/bets/analytics', { token: alice })).j.locked, true);
  assert.ok([402, 403].includes((await call('/api/bets/import', { method: 'POST', token: alice, body: { bets: [{ selection: 'x', odds: 2, stake: 1 }] } })).s));
  assert.ok((await call('/api/plan', { method: 'PUT', token: alice, body: { plan: 'pro' } })).s >= 400);
  assert.equal((await call('/api/admin/stats', { token: alice })).s, 403);
});

test('a junk currency in settings falls back to GBP', async () => {
  const { settings } = (await call('/api/settings', { token: alice })).j;
  const saved = await call('/api/settings', { method: 'PUT', token: alice, body: { settings: { ...settings, currency: '<script>' } } });
  assert.equal(saved.j.settings.currency, 'GBP');
});
