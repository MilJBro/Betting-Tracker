import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const TrackerContext = createContext(null);
const LS_KEY = 'bt_tracker';

export function TrackerProvider({ children }) {
  const [trackers, setTrackers] = useState([]);
  const [pro, setPro] = useState(false);
  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem(LS_KEY) || null; } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const persist = (id) => {
    setActiveId(id);
    try { if (id) localStorage.setItem(LS_KEY, id); } catch {}
  };

  const load = useCallback(async () => {
    const d = await api.get('/trackers');
    setTrackers(d.trackers);
    setPro(d.pro);
    // Keep the active id valid; default to the first tracker.
    setActiveId((cur) => {
      const ok = cur && d.trackers.some((t) => t.id === cur);
      const next = ok ? cur : (d.trackers[0]?.id || null);
      try { if (next) localStorage.setItem(LS_KEY, next); } catch {}
      return next;
    });
    return d.trackers;
  }, []);

  useEffect(() => { load().catch(() => {}).finally(() => setLoading(false)); }, [load]);

  const switchTo = useCallback((id) => persist(id), []);

  const create = useCallback(async (name, bankroll_start = 0) => {
    const d = await api.post('/trackers', { name, bankroll_start }); // throws on 402 (Pro)
    await load();
    persist(d.tracker.id);
    return d.tracker;
  }, [load]);

  const update = useCallback(async (id, patch) => {
    await api.put(`/trackers/${id}`, patch);
    await load();
  }, [load]);

  const remove = useCallback(async (id) => {
    await api.del(`/trackers/${id}`);
    const list = await load();
    setActiveId((cur) => (cur === id ? (list[0]?.id || null) : cur));
  }, [load]);

  const active = trackers.find((t) => t.id === activeId) || trackers[0] || null;

  return (
    <TrackerContext.Provider value={{ trackers, pro, active, activeId: active?.id || null, loading, refresh: load, switchTo, create, update, remove }}>
      {children}
    </TrackerContext.Provider>
  );
}

export const useTracker = () => useContext(TrackerContext);
