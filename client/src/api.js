// Thin fetch wrapper that attaches the auth token and unwraps JSON errors.
const BASE = '/api';

let token = localStorage.getItem('bt_token') || null;

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('bt_token', t);
  else localStorage.removeItem('bt_token');
}

export function getToken() {
  return token;
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  del: (p, body) => request(p, { method: 'DELETE', body }),
};
