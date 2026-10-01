// End to end: change the unit size through the real API and check the stats.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 4800 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'betbooks-units-'));
let server, token;

const call = async (path, { method = 'GET', body } = {}) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
};
const saveStaking = async (patch) => {
  const { settings } = await call('/api/settings');
  return (await call('/api/settings', { method: 'PUT', body: { settings: { ...settings, staking: { ...settings.staking, ...patch } } } })).settings.staking;
};

before(async () => {
  server = spawn(process.execPath, ['src/index.js'], {
    env: { ...process.env, PORT: String(PORT), DB_PATH: join(dir, 't.db'), JWT_SECRET: 'test-secret-not-real-0123456789', NODE_ENV: 'development' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const reg = await call('/api/auth/register', { method: 'POST', body: { email: 'u@example.com', username: 'unituser', password: 'correct-horse-9' } });
  token = reg.token;
});
after(() => { server?.kill(); rmSync(dir, { recursive: true, force: true }); });

test('changing unit size keeps past bets at their old size and totals add up', async () => {
  // Nothing to preserve yet, so the first size just replaces the default.
  let st = await saveStaking({ mode: 'units', unitSize: 10 });
  assert.deepEqual(st.unitHistory, [{ from: '', size: 10 }]);

  await call('/api/bets', { method: 'POST', body: { placed_at: '2026-01-10', selection: 'A', odds: 3, stake: 10, status: 'won' } }); // +£20 = +2u
  await call('/api/bets', { method: 'POST', body: { placed_at: '2026-02-10', selection: 'B', odds: 2, stake: 10, status: 'lost' } }); // -£10 = -1u
  let { stats } = await call('/api/bets/stats');
  assert.equal(stats.netProfit, 10);
  assert.equal(stats.netProfitU, 1);

  // Change to £20 units: past bets keep £10 units, so the record is unchanged.
  st = await saveStaking({ unitSize: 20, unitFrom: '2026-03-01' });
  assert.equal(st.unitSize, 20);
  assert.deepEqual(st.unitHistory, [{ from: '', size: 10 }, { from: '2026-03-01', size: 20 }]);
  assert.equal('unitFrom' in st, false);
  ({ stats } = await call('/api/bets/stats'));
  assert.equal(stats.netProfit, 10);
  assert.equal(stats.netProfitU, 1, 'past record unchanged by the new unit size');

  // A new bet after the change counts at £20.
  await call('/api/bets', { method: 'POST', body: { placed_at: '2026-03-05', selection: 'C', odds: 2, stake: 20, status: 'won' } }); // +£20 = +1u
  ({ stats } = await call('/api/bets/stats'));
  assert.equal(stats.netProfit, 30);
  assert.equal(stats.netProfitU, 2);

  // A stale client sending an old history can't overwrite it.
  st = await saveStaking({ unitHistory: [{ from: '', size: 999 }] });
  assert.equal(st.unitHistory.length, 2);

  // Re-expressing everything at £20 is an explicit choice.
  st = await saveStaking({ unitScope: 'all' });
  assert.deepEqual(st.unitHistory, [{ from: '', size: 20 }]);
  ({ stats } = await call('/api/bets/stats'));
  assert.equal(stats.netProfitU, 1.5); // £30 / £20
});
