export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateEmail(email) {
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return 'A valid email is required';
  }
  if (email.length > 254) return 'That email is too long';
  return null;
}

export function validateUsername(username) {
  if (!username || typeof username !== 'string' || username.trim().length < 2) {
    return 'Username must be at least 2 characters';
  }
  if (username.trim().length > 40) return 'Username must be 40 characters or fewer';
  return null;
}

export function validatePassword(password) {
  if (!password || typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (password.length > 200) return 'Password is too long';
  return null;
}
