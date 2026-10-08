// "Today" on the Insights page: midnight to now in the viewer's time zone.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { startOfDayMs } from '../src/routes/admin.js';

test('the day starts at midnight in the viewer\'s zone, not the server\'s', () => {
  const now = Date.UTC(2026, 9, 8, 0, 30); // 00:30 UTC on 8 Oct
  assert.equal(new Date(startOfDayMs(0, now)).toISOString(), '2026-10-08T00:00:00.000Z');
  // UK summer time (UTC+1, offset -60): it is already 01:30 on 8 Oct, so today began at 23:00 UTC the day before
  assert.equal(new Date(startOfDayMs(-60, now)).toISOString(), '2026-10-07T23:00:00.000Z');
  // New York (UTC-4 in October, offset 240): it is 20:30 on 7 Oct, so today began at 04:00 UTC on the 7th
  assert.equal(new Date(startOfDayMs(240, now)).toISOString(), '2026-10-07T04:00:00.000Z');
  // never in the future
  for (const tz of [-840, -60, 0, 300, 720]) assert.ok(startOfDayMs(tz, now) <= now && now - startOfDayMs(tz, now) < 24 * 3600 * 1000);
});

const PORT = 5800 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'betbooks-today-'));
const dbPath = join(dir, 't.db');
let server, owner, user;

const call = async (path, { method = 'GET', body, token } = {}) => {
  const r = await fetch(BASE + path, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const reg = async (n) => (await call('/api/auth/register', { method: 'POST', body: { email: `${n}@example.com`, username: n, password: 'correct-horse-9' } })).j.token;

before(async () => {
  server = spawn(process.execPath, ['src/index.js'], {
    env: { ...process.env, PORT: String(PORT), DB_PATH: dbPath, ADMIN_EMAILS: 'owner@example.com', JWT_SECRET: 'test-secret-not-real-0123456789', NODE_ENV: 'development' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  owner = await reg('owner'); user = await reg('regular');
  // two visits today, through the real beacon
  for (const sid of ['today-1', 'today-2']) await call('/api/track', { method: 'POST', token: user, body: { sid, path: '/bets' } });
  // and two visits from three days ago, written straight into the database
  const db = new Database(dbPath);
  const old = Date.now() - 3 * 24 * 3600 * 1000;
  for (const sid of ['old-1', 'old-2']) db.prepare('INSERT INTO analytics_events (ts, session_id, user_id, path, kind) VALUES (?, ?, NULL, ?, ?)').run(old, sid, '/', 'view');
  db.close();
});
after(() => { server?.kill(); rmSync(dir, { recursive: true, force: true }); });

test('Today shows only today\'s figures; a 7-day range includes the older visits', async () => {
  const today = (await call('/api/admin/stats?days=today&tz=0', { token: owner })).j;
  assert.equal(today.window.today, true);
  assert.equal(today.range.visitors, 2, 'old visits left out');
  assert.equal(today.today.visitors, 2);
  const week = (await call('/api/admin/stats?days=7&tz=0', { token: owner })).j;
  assert.equal(week.window.today, false);
  assert.equal(week.range.visitors, 4);
});

test('Today\'s chart is hourly, from midnight to the current hour, with quiet hours at zero', async () => {
  const j = (await call('/api/admin/stats?days=today&tz=0', { token: owner })).j;
  const hoursSoFar = new Date().getUTCHours() + 1;
  assert.equal(j.series.length, hoursSoFar);
  assert.ok(j.series.every((p, i) => p.d === String(i).padStart(2, '0')), 'labelled 00, 01, 02, ...');
  assert.equal(j.series.reduce((n, p) => n + p.views, 0), 2, 'today\'s two page views are in there');
  const daily = (await call('/api/admin/stats?days=7&tz=0', { token: owner })).j;
  assert.ok(daily.series.every((p) => p.d.length === 10), 'other ranges still bucket by date');
});

test('every deep dive loads for Today and says so', async () => {
  for (const m of ['live', 'visitors', 'views', 'signups', 'active', 'retention', 'pro', 'bets', 'scans', 'shares', 'session']) {
    const r = await call(`/api/admin/detail?metric=${m}&days=today&tz=-60`, { token: owner });
    assert.equal(r.s, 200, m);
    assert.ok(r.j.title && Array.isArray(r.j.summary), m);
    if (r.j.series) assert.ok(r.j.series.hourly && r.j.series.data.every((p) => /^\d{2}$/.test(p.d)), `${m} is hourly`);
  }
  const v = (await call('/api/admin/detail?metric=visitors&days=today&tz=0', { token: owner })).j;
  assert.equal(v.title, 'Visitors · today');
  assert.equal(v.summary[0].value, 2);
});

test('a bad time zone value falls back safely and non-admins are still refused', async () => {
  assert.equal((await call('/api/admin/stats?days=today&tz=banana', { token: owner })).s, 200);
  assert.equal((await call('/api/admin/stats?days=today&tz=99999', { token: owner })).s, 200);
  assert.equal((await call('/api/admin/stats?days=today', { token: user })).s, 403);
});
