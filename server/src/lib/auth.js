import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { db } from './db.js';

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

// The token carries the user's current token_version. Bumping that column
// (on password change, reset, or "log out everywhere") invalidates every
// token issued beforehand.
export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, tv: user.token_version ?? 0 },
    config.jwtSecret,
    { expiresIn: config.jwtTtl }
  );
}

// Express middleware: require a valid, current bearer token.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db
      .prepare('SELECT id, token_version FROM users WHERE id = ?')
      .get(payload.sub);
    if (!user || (payload.tv ?? 0) !== user.token_version) {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}
