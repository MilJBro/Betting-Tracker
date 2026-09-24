import { db } from './db.js';
import { config } from './config.js';

// Admin access is granted purely by email (set ADMIN_EMAILS on the server).
// There's no admin flag stored on the user, so access can be granted/revoked
// with an env change and never leaks into the database.
export function isAdminEmail(email) {
  if (!email) return false;
  return config.adminEmails.includes(String(email).trim().toLowerCase());
}

export function isAdmin(userId) {
  if (!userId) return false;
  const row = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
  return row ? isAdminEmail(row.email) : false;
}

// Express middleware — must run AFTER requireAuth (which sets req.userId).
export function requireAdmin(req, res, next) {
  if (!isAdmin(req.userId)) return res.status(403).json({ error: 'Not authorised' });
  next();
}
