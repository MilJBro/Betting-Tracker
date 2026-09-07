import { Router } from 'express';
import { nanoid } from 'nanoid';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '../lib/db.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
} from '../lib/auth.js';
import { DEFAULT_SETTINGS } from '../lib/defaults.js';
import { config } from '../lib/config.js';
import { entitlements } from '../lib/plan.js';
import { sendMail, passwordResetEmail } from '../lib/mailer.js';
import {
  validateEmail,
  validateUsername,
  validatePassword,
} from '../lib/validate.js';

const router = Router();

const publicUser = (row) => ({ id: row.id, email: row.email, username: row.username, plan: row.plan || 'free' });
const hashToken = (t) => createHash('sha256').update(t).digest('hex');

router.post('/register', (req, res) => {
  const { email, username, password } = req.body || {};
  const err =
    validateEmail(email) || validateUsername(username) || validatePassword(password);
  if (err) return res.status(400).json({ error: err });

  const normEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normEmail);
  if (existing)
    return res.status(409).json({ error: 'An account with that email already exists' });

  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO users (id, email, username, password, token_version, created_at) VALUES (?, ?, ?, ?, 0, ?)'
  ).run(id, normEmail, username.trim(), hashPassword(password), now);
  db.prepare('INSERT INTO settings (user_id, data) VALUES (?, ?)').run(
    id,
    JSON.stringify(DEFAULT_SETTINGS)
  );

  const user = { id, email: normEmail, username: username.trim(), token_version: 0 };
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const row = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email).trim().toLowerCase());
  if (!row || !verifyPassword(password, row.password))
    return res.status(401).json({ error: 'Incorrect email or password' });

  res.json({ token: signToken(row), user: publicUser(row) });
});

router.get('/me', requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT id, email, username, created_at, plan FROM users WHERE id = ?')
    .get(req.userId);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json({ user: row, entitlements: entitlements(req.userId) });
});

// Change password (authenticated). Requires the current password and
// re-issues a fresh token, invalidating sessions elsewhere.
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const err = validatePassword(newPassword);
  if (err) return res.status(400).json({ error: err });

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!row || !verifyPassword(currentPassword || '', row.password))
    return res.status(401).json({ error: 'Your current password is incorrect' });

  const tv = row.token_version + 1;
  db.prepare('UPDATE users SET password = ?, token_version = ? WHERE id = ?').run(
    hashPassword(newPassword),
    tv,
    req.userId
  );
  res.json({ token: signToken({ ...row, token_version: tv }), user: publicUser(row) });
});

// Log out of every device by bumping the token version.
router.post('/logout-all', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(
    req.userId
  );
  res.json({ ok: true });
});

// Request a password reset. Always responds 200 to avoid revealing whether
// an email is registered.
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  const generic = {
    ok: true,
    message: 'If that email is registered, a reset link is on its way.',
  };
  if (validateEmail(email)) return res.json(generic);

  const row = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.trim().toLowerCase());
  if (row) {
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?').run(
      hashToken(token),
      expires,
      row.id
    );
    const resetUrl = `${config.appUrl}/reset-password?token=${token}`;
    const mail = passwordResetEmail(resetUrl);
    await sendMail({ to: row.email, ...mail });
    // In development (no SMTP), surface the link so the flow is testable.
    if (!config.isProd && !config.smtp.host) return res.json({ ...generic, devResetUrl: resetUrl });
  }
  res.json(generic);
});

// Complete a password reset using the emailed token.
router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body || {};
  const err = validatePassword(newPassword);
  if (err) return res.status(400).json({ error: err });
  if (!token) return res.status(400).json({ error: 'Reset token is required' });

  const row = db
    .prepare('SELECT * FROM users WHERE reset_token = ?')
    .get(hashToken(token));
  if (!row || !row.reset_expires || new Date(row.reset_expires) < new Date())
    return res.status(400).json({ error: 'This reset link is invalid or has expired' });

  db.prepare(
    'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL, token_version = token_version + 1 WHERE id = ?'
  ).run(hashPassword(newPassword), row.id);
  res.json({ ok: true, message: 'Password updated — you can now log in.' });
});

// Export all of the user's data as JSON.
router.get('/export', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, email, username, created_at FROM users WHERE id = ?')
    .get(req.userId);
  const bets = db
    .prepare('SELECT * FROM bets WHERE user_id = ? ORDER BY placed_at')
    .all(req.userId)
    .map((b) => ({ ...b, tags: b.tags ? JSON.parse(b.tags) : [] }));
  const settingsRow = db.prepare('SELECT data FROM settings WHERE user_id = ?').get(req.userId);
  res.setHeader('Content-Disposition', 'attachment; filename="betfolio-export.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    user,
    settings: settingsRow ? JSON.parse(settingsRow.data) : null,
    bets,
  });
});

// Delete the account and everything attached to it (bets, settings, share).
router.delete('/account', requireAuth, (req, res) => {
  const { password } = req.body || {};
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!row) return res.status(404).json({ error: 'User not found' });
  if (!verifyPassword(password || '', row.password))
    return res.status(401).json({ error: 'Password is incorrect' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.userId); // cascades
  res.json({ ok: true });
});

export default router;
