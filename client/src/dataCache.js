// A tiny in-memory cache so navigating back to a page (tab switch, or after
// adding a bet) renders instantly from the last-known data and refreshes
// quietly in the background — no spinner flash on pages you've already seen.
// It lives only for the session and is cleared on logout.
const cache = new Map();

export const getCached = (key) => cache.get(key);
export const setCached = (key, value) => { cache.set(key, value); };
export const clearCache = () => cache.clear();
