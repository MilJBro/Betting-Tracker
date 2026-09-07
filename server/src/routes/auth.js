import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../lib/db.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
} from '../lib/auth.js';
import { DEFAULT_SETTINGS } from '../lib/defaults.js';

const router = Router();

const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

router.post('/register', (req, res) => {
  const { email, username, password } = req.body || {};
  if (!email || !emailRe.test(email))
    return res.status(400).json({ error: 'A valid email is required' });
  if (!username || username.trim().length < 2)
    return res.status(400).json({ error: 'Username must be at least 2 characters' });
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email.toLowerCase());
  if (existing)
    return res.status(409).json({ error: 'An account with that email already exists' });

  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO users (id, email, username, password, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, email.toLowerCase(), username.trim(), hashPassword(password), now);

  db.prepare('INSERT INTO settings (user_id, data) VALUES (?, ?)').run(
    id,
    JSON.stringify(DEFAULT_SETTINGS)
  );

  const user = { id, email: email.toLowerCase(), username: username.trim() };
  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const row = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email).toLowerCase());
  if (!row || !verifyPassword(password, row.password))
    return res.status(401).json({ error: 'Incorrect email or password' });

  const user = { id: row.id, email: row.email, username: row.username };
  res.json({ token: signToken(user), user });
});

router.get('/me', requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT id, email, username, created_at FROM users WHERE id = ?')
    .get(req.userId);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json({ user: row });
});

export default router;
