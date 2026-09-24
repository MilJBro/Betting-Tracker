import { api } from './api.js';

// A stable, anonymous per-browser id so the admin Insights page can count
// unique visitors and session length without any personal data. It is NOT tied
// to a login and carries no meaning beyond "this browser".
function sessionId() {
  try {
    let id = localStorage.getItem('bt_sid');
    if (!id) {
      id = 's_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      localStorage.setItem('bt_sid', id);
    }
    return id;
  } catch {
    return 's_anon';
  }
}

// Fire-and-forget usage beacon. Errors are swallowed — tracking must never
// affect the app. The auth token (when present) is attached by api, so the
// server can attribute the event to the signed-in user.
export function track(path, kind = 'view') {
  try {
    api.post('/track', { sid: sessionId(), path, kind }).catch(() => {});
  } catch {
    /* ignore */
  }
}
