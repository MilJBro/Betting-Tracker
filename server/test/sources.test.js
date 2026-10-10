// Traffic sources: normalising referrers/tags, and the numbers on the Insights page.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanSource } from '../src/lib/source.js';

test('referrers and tags become tidy source names', () => {
  assert.equal(cleanSource('', 't.co'), 'X / Twitter');
  assert.equal(cleanSource('', 'twitter.com'), 'X / Twitter');
  assert.equal(cleanSource('', 'x.com'), 'X / Twitter');
  assert.equal(cleanSource('', 'mobile.twitter.com'), 'X / Twitter');
  assert.equal(cleanSource('X', ''), 'X / Twitter');
  assert.equal(cleanSource('twitter', 'example.org'), 'X / Twitter', 'an explicit tag beats the referrer');
  assert.equal(cleanSource('', 'www.google.co.uk'), 'Google');
  assert.equal(cleanSource('', 'l.facebook.com'), 'Facebook');
  assert.equal(cleanSource('', 'news.ycombinator.com'), 'news.ycombinator.com');
  assert.equal(cleanSource('', 'betbooks.co.uk'), null, 'our own site is not a source');
  assert.equal(cleanSource('', 'checkout.stripe.com'), null);
  assert.equal(cleanSource('', ''), null);
  assert.equal(cleanSource(undefined, undefined), null);
  assert.equal(cleanSource('', 'bad host<script>'), null);
  assert.equal(cleanSource('<b>x</b>', ''), 'bxb', 'markup characters are stripped from tags');
});

const PORT = 6200 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'betbooks-src-'));
let server, owner;
const call = async (path, { method = 'GET', body, token } = {}) => {
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
before(async () => {
  server = spawn(process.execPath, ['src/index.js'], { env: { ...process.env, PORT: String(PORT), DB_PATH: join(dir, 's.db'), ADMIN_EMAILS: 'owner@example.com', JWT_SECRET: 'test-secret-not-real-0123456789', NODE_ENV: 'development' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  owner = (await call('/api/auth/register', { method: 'POST', body: { email: 'owner@example.com', username: 'owner', password: 'correct-horse-9' } })).j.token;
});
after(() => { server?.kill(); rmSync(dir, { recursive: true, force: true }); });

test('visitors and signups are counted per source on the Insights page', async () => {
  // two visitors from X (one by referrer, one by a tagged link), one from Google, one direct
  await call('/api/track', { method: 'POST', body: { sid: 'a', path: '/', host: 't.co' } });
  await call('/api/track', { method: 'POST', body: { sid: 'a', path: '/pricing', host: 't.co' } }); // same visitor again
  await call('/api/track', { method: 'POST', body: { sid: 'b', path: '/', ref: 'x' } });
  await call('/api/track', { method: 'POST', body: { sid: 'c', path: '/', host: 'www.google.com' } });
  await call('/api/track', { method: 'POST', body: { sid: 'd', path: '/' } });
  // a signup that arrived from X
  const r = await call('/api/auth/register', { method: 'POST', body: { email: 'fromx@example.com', username: 'fromx', password: 'correct-horse-9', acq: { ref: '', host: 't.co' } } });
  assert.equal(r.s, 201);

  const j = (await call('/api/admin/stats?days=7&tz=0', { token: owner })).j;
  const by = Object.fromEntries(j.sources.map((s) => [s.source, s]));
  assert.equal(by['X / Twitter'].visitors, 2, 'the repeat visit is one visitor');
  assert.equal(by['X / Twitter'].signups, 1);
  assert.equal(by['Google'].visitors, 1);
  assert.equal(by['Direct / unknown'].visitors, 1);
  assert.equal(by['Direct / unknown'].signups, 1, 'the owner signed up with no source');
  assert.equal(j.sources[0].source, 'X / Twitter', 'busiest first');

  const d = (await call('/api/admin/detail?metric=sources&days=7&tz=0', { token: owner })).j;
  assert.equal(d.summary[0].value, 2);
  assert.equal(d.summary[1].value, 1);
  assert.match(d.lists[0].rows[0].sub, /1 signup/);
  assert.equal((await call('/api/admin/detail?metric=sources', { token: undefined })).s, 401);
});

test('the owner\'s own visits are not recorded, and old ones are purged', async () => {
  const before = (await call('/api/admin/stats?days=7&tz=0', { token: owner })).j.range.visitors;
  // a signed-in beacon from the owner is dropped
  await call('/api/track', { method: 'POST', token: owner, body: { sid: 'owner-browser', path: '/admin' } });
  // a stranger's is kept
  await call('/api/track', { method: 'POST', body: { sid: 'stranger', path: '/' } });
  const after = (await call('/api/admin/stats?days=7&tz=0', { token: owner })).j.range.visitors;
  assert.equal(after - before, 1, 'only the stranger counted');
});
