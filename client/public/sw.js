// Minimal service worker. Its only job is to make Betbooks installable as a
// PWA (some browsers require a registered SW with a fetch handler before they
// offer "install"). It does NO caching — every request goes straight to the
// network — so the installed app can never be pinned to a stale build.
//
// Reliability on resume (blank screen / mis-sized layout after iOS wakes a
// suspended app) is handled in the page instead, by reloading on resume — see
// pwa.js. That always produces a fresh network load rather than replaying a
// cached shell.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Wipe any caches left by earlier service-worker versions that DID cache
    // the shell, so nobody is stuck on an old build.
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', () => {
  // No respondWith(): the browser handles every request from the network as
  // usual. Having the listener is enough to satisfy install criteria.
});
