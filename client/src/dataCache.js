// A tiny in-memory cache so navigating back to a page (tab switch, or after
// adding a bet) renders instantly from the last-known data and refreshes
// quietly in the background — no spinner flash on pages you've already seen.
// It lives only for the session and is cleared on logout.
const cache = new Map();

export const getCached = (key) => cache.get(key);
export const setCached = (key, value) => { cache.set(key, value); };
export const clearCache = () => cache.clear();

// A tiny pub/sub so a change made from a global overlay (e.g. adding a bet
// without leaving the current tab) can tell whatever page is on screen to
// reload. invalidateData() drops the cached data and notifies subscribers.
const listeners = new Set();
export const subscribeInvalidate = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const invalidateData = () => {
  cache.clear();
  listeners.forEach((fn) => { try { fn(); } catch {} });
};
