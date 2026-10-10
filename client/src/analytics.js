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

// Where this browser first came from: an explicit tag on the link (?ref=x or
// ?utm_source=…) and/or the referring site. Read once at load — before the app
// router can rewrite the URL — and remembered, so a signup later still credits
// the first source. Direct visits are not pinned, so a later referral can still
// claim the browser. Nothing personal is stored: just a tag and a hostname.
const OWN = /(^|\.)(betbooks\.co\.uk|stripe\.com|onrender\.com|localhost)$/;
function readAcquisition() {
  try {
    const saved = localStorage.getItem('bt_acq');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  try {
    const q = new URLSearchParams(window.location.search);
    const ref = (q.get('ref') || q.get('utm_source') || q.get('src') || '').slice(0, 40);
    let host = '';
    try { host = document.referrer ? new URL(document.referrer).hostname : ''; } catch { /* ignore */ }
    if (OWN.test(host)) host = '';
    if (!ref && !host) return {};
    const acq = { ref, host: host.slice(0, 80) };
    try { localStorage.setItem('bt_acq', JSON.stringify(acq)); } catch { /* ignore */ }
    return acq;
  } catch {
    return {};
  }
}
// The site owner's own browsing is left out of the Insights numbers. A device is
// marked as the owner's automatically when an owner signs in on it, or by hand
// with /?notrack=1 (undo with /?notrack=0), so even logged-out visits are skipped.
function ownerDevice() {
  try {
    const flag = new URLSearchParams(window.location.search).get('notrack');
    if (flag === '1') localStorage.setItem('bt_notrack', '1');
    if (flag === '0') localStorage.removeItem('bt_notrack');
    return localStorage.getItem('bt_notrack') === '1';
  } catch {
    return false;
  }
}
let OWNER = ownerDevice();
export function markOwnerDevice() {
  OWNER = true;
  try { localStorage.setItem('bt_notrack', '1'); } catch { /* ignore */ }
}

const ACQ = readAcquisition();
export const acquisition = () => ACQ;

// Fire-and-forget usage beacon. Errors are swallowed — tracking must never
// affect the app. The auth token (when present) is attached by api, so the
// server can attribute the event to the signed-in user.
export function track(path, kind = 'view') {
  if (OWNER) return;
  try {
    api.post('/track', { sid: sessionId(), path, kind, ...ACQ }).catch(() => {});
  } catch {
    /* ignore */
  }
}
