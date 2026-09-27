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

async function request(path, { method = 'GET', body, timeoutMs = 20000 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  // Hard timeout so a stalled request never hangs the UI forever. Every request
  // gets one by default (iOS can hand a resumed page a dead socket that never
  // settles, which used to wedge the app on the boot splash); callers can pass
  // their own timeoutMs to lengthen it (e.g. the multi-image scan).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      const e = new Error('Timed out — please try again.');
      e.timeout = true;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data; // carries e.g. { upgrade: true, scans } for gated features
    throw err;
  }
  return data;
}

export const api = {
  get: (p, opts) => request(p, opts),
  post: (p, body, opts) => request(p, { method: 'POST', body, ...opts }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  del: (p, body) => request(p, { method: 'DELETE', body }),
};
