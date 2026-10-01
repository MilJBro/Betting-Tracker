// Run with: npm test   (starts the real server on a spare port with a throwaway database)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clientIp } from '../src/lib/limits.js';

const PORT = 4300 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'betbooks-limits-'));
let server;

// Each fake visitor is a different CF-Connecting-IP, as Cloudflare would send.
const call = (path, { ip, method = 'GET', body, token } = {}) =>
  fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(ip ? { 'cf-connecting-ip': ip } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
const login = (ip, password) => call('/api/auth/login', { ip, method: 'POST', body: { email: 'limits@example.com', password } });

before(async () => {
  server = spawn(process.execPath, ['src/index.js'], {
    env: { ...process.env, PORT: String(PORT), DB_PATH: join(dir, 't.db'), JWT_SECRET: 'test-secret-not-real-0123456789', NODE_ENV: 'development' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  const r = await call('/api/auth/register', { ip: '10.9.9.9', method: 'POST', body: { email: 'limits@example.com', username: 'limits', password: 'correct-horse-9' } });
  assert.equal(r.status, 201);
});
after(() => { server?.kill(); rmSync(dir, { recursive: true, force: true }); });

test('clientIp prefers Cloudflare\'s header, ignores junk, falls back to req.ip', () => {
  assert.equal(clientIp({ headers: { 'cf-connecting-ip': '203.0.113.7' }, ip: '10.0.0.1' }), '203.0.113.7');
  assert.equal(clientIp({ headers: { 'cf-connecting-ip': ' 2001:db8::5 ' }, ip: '10.0.0.1' }), '2001:db8::5');
  assert.equal(clientIp({ headers: { 'cf-connecting-ip': 'not-an-ip' }, ip: '10.0.0.1' }), '10.0.0.1');
  assert.equal(clientIp({ headers: { 'true-client-ip': '198.51.100.4' }, ip: '10.0.0.1' }), '198.51.100.4');
  assert.equal(clientIp({ headers: {}, ip: '10.0.0.1' }), '10.0.0.1');
  assert.equal(clientIp({ headers: {} }), 'unknown');
});

test('wrong passwords are limited per visitor: 20 allowed, then blocked, other visitors unaffected', async () => {
  for (let i = 1; i <= 20; i++) assert.equal((await login('10.1.1.1', 'wrong')).status, 401, `attempt ${i}`);
  assert.equal((await login('10.1.1.1', 'wrong')).status, 429, '21st wrong attempt is blocked');
  assert.equal((await login('10.1.1.2', 'wrong')).status, 401, 'a different visitor still gets through');
  // The blocked visitor is blocked even with the right password until the window passes.
  assert.equal((await login('10.1.1.1', 'correct-horse-9')).status, 429);
});

test('correct sign-ins are never counted, however many', async () => {
  for (let i = 1; i <= 30; i++) assert.equal((await login('10.2.2.2', 'correct-horse-9')).status, 200, `sign-in ${i}`);
});

test('the app-launch check (GET /me) is not held to the strict limit', async () => {
  const token = (await (await login('10.3.3.3', 'correct-horse-9')).json()).token;
  for (let i = 1; i <= 60; i++) assert.equal((await call('/api/auth/me', { ip: '10.3.3.3', token })).status, 200, `launch ${i}`);
});

test('one visitor shares one counter across requests; a new visitor starts fresh (the live bug: it never did)', async () => {
  const left = async (ip) => Number((await login(ip, 'wrong')).headers.get('ratelimit-remaining'));
  const first = await left('10.4.4.4');
  assert.equal(await left('10.4.4.4'), first - 1);
  assert.equal(await left('10.4.4.4'), first - 2);
  assert.equal(await left('10.4.4.5'), first, 'a different visitor starts from the full allowance');
});

test('password-reset requests are limited even though they always answer 200', async () => {
  for (let i = 1; i <= 20; i++) assert.equal((await call('/api/auth/forgot-password', { ip: '10.5.5.5', method: 'POST', body: { email: 'nobody@example.com' } })).status, 200, `request ${i}`);
  assert.equal((await call('/api/auth/forgot-password', { ip: '10.5.5.5', method: 'POST', body: { email: 'nobody@example.com' } })).status, 429);
});

test('without the Cloudflare header (local use) requests still work and are counted', async () => {
  const r = await login(undefined, 'wrong');
  assert.equal(r.status, 401);
  assert.ok(r.headers.get('ratelimit-remaining'));
});

test('a made-up CF-Connecting-IP value does not crash the server', async () => {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': 'garbage<script>' }, body: JSON.stringify({ email: 'a@b.c', password: 'x' }) });
  assert.equal(r.status, 401);
});
