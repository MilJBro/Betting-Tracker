import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { useAuth } from './AuthContext.jsx';
import { THEME_STYLES, DEFAULT_THEME } from '../themes.js';

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

  // A style is a whole visual language (radius, card treatment, heading face,
  // label casing) — this is what makes each theme look like a different app.
  const style = THEME_STYLES[theme.style] || THEME_STYLES.soft;
  root.style.setProperty('--font-head', style.headFont);
  root.style.setProperty('--radius', style.radius);
  root.style.setProperty('--radius-sm', style.radiusSm);
  root.style.setProperty('--card-border', style.cardBorder);
  root.style.setProperty('--card-shadow', style.cardShadow);
  root.style.setProperty('--label-transform', style.labelTransform);
  root.style.setProperty('--label-spacing', style.labelSpacing);
  root.style.setProperty('--head-transform', style.headTransform);
  root.style.setProperty('--head-spacing', style.headSpacing);
}

// The locked-in design, with ONLY the user's accent colour (theme.primary)
// allowed through. Everything else — dark mode, background, surface, soft
// style, font — stays fixed so the app can't be made unusable.
export function resolveTheme(settings) {
  const chosen = settings?.theme?.primary || DEFAULT_THEME.primary;
  return { ...DEFAULT_THEME, primary: chosen, accent: chosen };
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
      const theme = resolveTheme(d.settings);
      setSettings({ ...d.settings, theme });
      applyTheme(theme);
    });
  }, [user]);

  // Optimistic local update + persist. The whole design stays locked to the
  // default EXCEPT the user's chosen accent colour (theme.primary).
  const save = useCallback(async (next) => {
    const theme = resolveTheme(next);
    const stored = { ...next, theme };
    setSettings(stored);
    applyTheme(theme);
    const d = await api.put('/settings', { settings: stored });
    const t2 = resolveTheme(d.settings);
    setSettings({ ...d.settings, theme: t2 });
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
