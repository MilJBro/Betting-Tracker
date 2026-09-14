// Minimal service worker. Its only job is to make Betbooks installable as a
// PWA (some browsers require a registered SW with a fetch handler before they
// offer "install"). It deliberately does NO caching, so a new deploy is never
// served stale — every request goes straight to the network as normal.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // No respondWith() — the browser handles the request from the network as
  // usual. Having the listener is enough to satisfy install criteria.
});
