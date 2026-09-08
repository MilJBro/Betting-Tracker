import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Reads the current user's plan + entitlements (usage, features) from the
// server, which is the source of truth. Use it to show scan meters, lock
// badges and the upgrade CTA — never to enforce access (the API does that).
export function usePlan() {
  const [ent, setEnt] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    () =>
      api
        .get('/plan')
        .then((e) => setEnt(e))
        .catch(() => {})
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => { refresh(); }, [refresh]);

  return { ent, loading, refresh, setEnt };
}
