import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { getCached, setCached } from './dataCache.js';

// Reads the current user's plan + entitlements (usage, features) from the
// server, which is the source of truth. Use it to show scan meters, lock
// badges and the upgrade CTA — never to enforce access (the API does that).
// The result is cached for the session so opening the Account tab shows the
// plan instantly instead of popping the upgrade CTA in and shifting the page.
export function usePlan() {
  const [ent, setEnt] = useState(() => getCached('plan') ?? null);
  const [loading, setLoading] = useState(() => !getCached('plan'));

  const refresh = useCallback(
    () =>
      api
        .get('/plan')
        .then((e) => { setEnt(e); setCached('plan', e); })
        .catch(() => {})
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => { refresh(); }, [refresh]);

  return { ent, loading, refresh, setEnt };
}
