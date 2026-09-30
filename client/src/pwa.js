// PWA install helpers. Imported once from main.jsx so the beforeinstallprompt
// listener is attached before the browser fires it (it fires early, often
// before any React component mounts).

let deferredPrompt = null;
const subscribers = new Set();
const notify = () => subscribers.forEach((fn) => { try { fn(); } catch {} });

// Returning from Stripe (Manage payment / checkout) navigates the installed app
// out and back, and iOS lays the returning page out with a stale viewport —
// which raises the fixed bottom nav off the bottom. If we flagged a Stripe trip
// on the way out (see Account.jsx), do one clean reload on return so the page
// lays out correctly. Call this from main.jsx BEFORE React mounts and skip
// rendering when it returns true, so the reload can't abort an in-flight
// request (an aborted /auth/me would otherwise be treated as a logout). The
// flag is cleared first, so this never loops.
export function reloadIfReturningFromStripe() {
  if (typeof window === 'undefined') return false;
  try {
    const t = Number(localStorage.getItem('bt_stripe_return') || 0);
    if (!t) return false;
    localStorage.removeItem('bt_stripe_return');
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (standalone && Date.now() - t < 15 * 60 * 1000) {
      window.location.reload();
      return true;
    }
  } catch {}
  return false;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Stash the event so we can trigger the native install prompt from a button.
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
  // Recover a page that iOS froze/suspended MID-boot. When we return to the app
  // and the boot splash is STILL up, the first load never finished and any
  // in-flight startup requests are now dead sockets that will never settle — so
  // reload once to re-issue them. A fully-loaded page has no #boot element, so
  // this never throws away a good live page; a sessionStorage guard stops it
  // looping on a genuinely slow/cold server, and it clears once the app loads
  // so a later stuck resume can retry. A short delay first lets a page that was
  // simply mid-load finish booting on its own.
  let bootRecoveryTimer = null;
  function armBootRecovery() {
    if (typeof document === 'undefined') return;
    if (document.visibilityState !== 'visible') return;
    if (!document.getElementById('boot')) {
      try { sessionStorage.removeItem('bt_boot_reload'); } catch {}
      return;
    }
    if (bootRecoveryTimer) return;
    bootRecoveryTimer = setTimeout(() => {
      bootRecoveryTimer = null;
      if (document.visibilityState !== 'visible' || !document.getElementById('boot')) return;
      try {
        if (sessionStorage.getItem('bt_boot_reload')) return; // already retried this episode
        sessionStorage.setItem('bt_boot_reload', '1');
      } catch {}
      window.location.reload();
    }, 2500);
  }

  // The INSTALLED (standalone) app on iOS can restore from the back/forward
  // cache as a frozen, blank shell after being suspended, so there we reload to
  // boot fresh. A browser tab usually restores correctly, so we only step in
  // when it comes back visibly stuck on the boot splash (armBootRecovery).
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    if (isStandalone()) window.location.reload();
    else armBootRecovery();
  });
  // iOS can also FREEZE a tab (without a bfcache pageshow) and resume it later;
  // a visibility change is the signal we get for that. Harmless once loaded.
  document.addEventListener('visibilitychange', armBootRecovery);
}

// Register the (no-op) service worker so browsers consider the app installable.
export function registerSW() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

export const getInstallPrompt = () => deferredPrompt;
export const clearInstallPrompt = () => { deferredPrompt = null; };
export function onInstallChange(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

// The app is already running from the home screen (installed).
export const isStandalone = () =>
  (typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true));

export const isIOS = () =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
