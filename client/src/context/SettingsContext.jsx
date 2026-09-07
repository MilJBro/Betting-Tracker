import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { useAuth } from './AuthContext.jsx';

const SettingsContext = createContext(null);

// Push the active theme into CSS custom properties so the whole UI recolours
// live as the user tweaks their dashboard.
export function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement;
  const dark = theme.mode !== 'light';
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--bg', dark ? theme.background : '#f4f6fb');
  root.style.setProperty('--surface', dark ? theme.surface : '#ffffff');
  root.style.setProperty('--surface-2', dark ? '#0d1626' : '#eef1f7');
  root.style.setProperty('--text', dark ? '#e6edf7' : '#131722');
  root.style.setProperty('--muted', dark ? '#8a97ab' : '#5b6675');
  root.style.setProperty('--border', dark ? '#20304d' : '#dde3ec');
  root.setAttribute('data-mode', dark ? 'dark' : 'light');
  const fonts = {
    system: '"Manrope", system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    rounded: '"Nunito", "Segoe UI", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, "Courier New", monospace',
    serif: 'Georgia, "Times New Roman", serif',
  };
  root.style.setProperty('--font', fonts[theme.font] || fonts.system);
  // Headings/brand keep a consistent display face regardless of body choice.
  root.style.setProperty(
    '--font-head',
    theme.font === 'serif' || theme.font === 'mono'
      ? fonts[theme.font]
      : '"Sora", "Manrope", system-ui, sans-serif'
  );
}

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (!user) {
      setSettings(null);
      return;
    }
    api.get('/settings').then((d) => {
      setSettings(d.settings);
      applyTheme(d.settings.theme);
    });
  }, [user]);

  // Optimistic local update + persist.
  const save = useCallback(async (next) => {
    setSettings(next);
    applyTheme(next.theme);
    const d = await api.put('/settings', { settings: next });
    setSettings(d.settings);
    return d.settings;
  }, []);

  const update = useCallback(
    (patch) => {
      if (!settings) return;
      return save({ ...settings, ...patch });
    },
    [settings, save]
  );

  return (
    <SettingsContext.Provider value={{ settings, setSettings, save, update, applyTheme }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
