// Curated theme presets — each is intentionally very different so a single
// click restyles the whole app. Applying a preset just patches settings.theme,
// so the granular controls below still work as fine-tuning afterwards.
export const THEME_PRESETS = [
  {
    key: 'midnight',
    name: 'Midnight',
    blurb: 'Deep navy, cool green',
    theme: { mode: 'dark', primary: '#22c55e', accent: '#3b82f6', background: '#0b1120', surface: '#111a2e', font: 'system' },
  },
  {
    key: 'daylight',
    name: 'Daylight',
    blurb: 'Bright & clean',
    theme: { mode: 'light', primary: '#2563eb', accent: '#7c3aed', background: '#f4f6fb', surface: '#ffffff', font: 'system' },
  },
  {
    key: 'neon',
    name: 'Neon',
    blurb: 'Electric purple & cyan',
    theme: { mode: 'dark', primary: '#a855f7', accent: '#22d3ee', background: '#0a0a12', surface: '#14121f', font: 'mono' },
  },
  {
    key: 'gold',
    name: 'Gold',
    blurb: 'Warm, editorial',
    theme: { mode: 'dark', primary: '#eab308', accent: '#f59e0b', background: '#14110a', surface: '#1c1810', font: 'serif' },
  },
];

// Best-effort match of the current theme to a preset (for showing which card
// is active). Compares the fields a preset actually sets.
export function matchPreset(theme) {
  if (!theme) return null;
  const p = THEME_PRESETS.find((preset) =>
    Object.entries(preset.theme).every(([k, v]) =>
      k === 'background' || k === 'surface'
        ? (theme.mode === 'light' ? true : theme[k] === v) // light uses a fixed palette
        : theme[k] === v
    )
  );
  return p ? p.key : null;
}
