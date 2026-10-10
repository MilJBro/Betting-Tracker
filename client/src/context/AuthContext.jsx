import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from '../api.js';
import { acquisition, markOwnerDevice } from '../analytics.js';
import { clearCache } from '../dataCache.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      // Retry transient failures a few times before giving up, so a flaky
      // network on resume doesn't bounce a signed-in user to the landing page
      // (or leave the app wedged on the boot splash).
      for (let attempt = 0; !cancelled; attempt++) {
        try {
          const d = await api.get('/auth/me', { timeoutMs: 10000 });
          if (!cancelled) setUser(d.user);
          break;
        } catch (err) {
          if (cancelled) return;
          // Only sign out on a genuine auth rejection (401). A transient failure
          // (timeout, flaky network on resume, a request aborted by a reload)
          // must NOT wipe the token, or the user gets logged out for no reason.
          if (err?.status === 401) { setToken(null); break; }
          if (attempt >= 3) break;
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // An owner signing in marks this device, so their visits stay out of Insights.
  useEffect(() => { if (user?.isAdmin) markOwnerDevice(); }, [user]);

  async function login(email, password) {
    const d = await api.post('/auth/login', { email, password });
    setToken(d.token);
    setUser(d.user);
    return d.user;
  }

  async function register(email, username, password) {
    const d = await api.post('/auth/register', { email, username, password, acq: acquisition() });
    setToken(d.token);
    setUser(d.user);
    return d.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
    clearCache();
  }

  // Re-read the signed-in user (e.g. after editing the display name).
  const refreshUser = () => api.get('/auth/me').then((d) => setUser(d.user)).catch(() => {});

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
