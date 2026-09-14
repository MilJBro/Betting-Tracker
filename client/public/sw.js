// Service worker for Betbooks.
//
// Goal: make the app installable AND reliable on resume, without ever serving
// a stale deploy while online.
//
//  - Navigations (loading the page itself) are NETWORK-FIRST: when online you
//    always get the freshest index.html, so a new deploy is picked up straight
//    away. The successful response is copied into the cache.
//  - If the network is slow or unavailable (e.g. iOS wakes the installed app
//    after it was suspended, before the connection is ready), we fall back to
//    the cached index.html instead of a blank white screen. React then boots
//    and fetches the (fingerprinted) assets as normal.
//  - All other requests (fingerprinted JS/CSS/images, API calls) go straight
//    to the network untouched.
const SHELL_CACHE = 'betbooks-shell-v1';
const SHELL_URL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add(SHELL_URL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only take over top-level page navigations. Everything else is left to the
  // browser's normal network handling.
  if (req.mode !== 'navigate') return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache the fresh shell for the next offline/cold resume.
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put(SHELL_URL, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(SHELL_URL).then((cached) => cached || Response.error()))
  );
});
