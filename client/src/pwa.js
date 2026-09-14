// PWA install helpers. Imported once from main.jsx so the beforeinstallprompt
// listener is attached before the browser fires it (it fires early, often
// before any React component mounts).

let deferredPrompt = null;
const subscribers = new Set();
const notify = () => subscribers.forEach((fn) => { try { fn(); } catch {} });

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
  // iOS Safari (and the installed app) can restore the page from the back/
  // forward cache as a frozen, blank shell when it's reopened after being
  // suspended — showing a white screen, or a mis-sized layout with a gap under
  // the bottom nav — until it's force-quit. Reload on that restore so the app
  // boots fresh instead.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) window.location.reload();
  });

  // pageshow/persisted doesn't fire reliably when the *installed* app is
  // resumed on iOS, so also watch visibility. When the standalone app comes
  // back to the foreground after being backgrounded for more than a moment,
  // force a fresh load — this is what manually swiping the app away and
  // reopening does, and it clears the white-screen and bottom-gap glitches
  // that iOS leaves behind on resume. Guarded to the installed app so a
  // browser tab is never disrupted.
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (isStandalone() && hiddenAt && Date.now() - hiddenAt > 400) {
      window.location.reload();
    }
  });
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
