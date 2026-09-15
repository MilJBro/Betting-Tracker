import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from '../api.js';
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
    api
      .get('/auth/me')
      .then((d) => setUser(d.user))
      .catch((err) => {
        // Only sign out on a genuine auth rejection (401). A transient failure
        // — a flaky network on resume, or a request aborted by a reload — must
        // NOT wipe the token, or the user gets logged out for no reason.
        if (err?.status === 401) setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const d = await api.post('/auth/login', { email, password });
    setToken(d.token);
    setUser(d.user);
    return d.user;
  }

  async function register(email, username, password) {
    const d = await api.post('/auth/register', { email, username, password });
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
