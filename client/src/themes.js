// Curated theme presets — each is intentionally very different so a single
// click restyles the whole app. Applying a preset just patches settings.theme,
// so the granular controls below still work as fine-tuning afterwards.
// Each theme carries a "style" key on top of its colours. A style is a whole
// visual language — heading typeface, corner radius, how cards are separated
// (border vs shadow vs glow), and how labels/headings are cased — so switching
// themes changes the feel of the app, not just its palette.
export const THEME_STYLES = {
  // Modern SaaS: soft rounded cards, hairline borders, geometric sans headings.
  soft: {
    headFont: '"Sora", "Manrope", system-ui, sans-serif',
    radius: '16px', radiusSm: '11px',
    cardBorder: '1px solid var(--border)',
    cardShadow: 'none',
    labelTransform: 'uppercase', labelSpacing: '0.06em',
    headTransform: 'none', headSpacing: '-0.01em',
  },
  // Airy & friendly: big radii, borderless cards floating on soft shadows,
  // rounded typeface, gentle sentence-case labels.
  airy: {
    headFont: '"Nunito", "Segoe UI", system-ui, sans-serif',
    radius: '22px', radiusSm: '14px',
    cardBorder: '1px solid transparent',
    cardShadow: '0 14px 38px rgba(2, 6, 23, 0.10)',
    labelTransform: 'none', labelSpacing: '0.005em',
    headTransform: 'none', headSpacing: '-0.02em',
  },
  // Cyber terminal: tight radii, monospace throughout, bright accent borders
  // and a coloured glow instead of a drop shadow, wide-tracked upper labels.
  cyber: {
    headFont: '"JetBrains Mono", ui-monospace, monospace',
    radius: '8px', radiusSm: '6px',
    cardBorder: '1px solid color-mix(in srgb, var(--accent) 42%, var(--border))',
    cardShadow: '0 0 28px color-mix(in srgb, var(--primary) 16%, transparent)',
    labelTransform: 'uppercase', labelSpacing: '0.16em',
    headTransform: 'uppercase', headSpacing: '0.02em',
  },
  // Editorial: near-square corners, hairline rules, a high-contrast serif
  // display face for headings and small-caps-style tracked labels.
  editorial: {
    headFont: '"Fraunces", Georgia, "Times New Roman", serif',
    radius: '3px', radiusSm: '3px',
    cardBorder: '1px solid var(--border)',
    cardShadow: 'none',
    labelTransform: 'uppercase', labelSpacing: '0.18em',
    headTransform: 'none', headSpacing: '0',
  },
};

export const THEME_PRESETS = [
  {
    key: 'midnight',
    name: 'Midnight',
    blurb: 'Clean & modern',
    theme: { mode: 'dark', primary: '#22c55e', accent: '#3b82f6', background: '#0b1120', surface: '#111a2e', font: 'system', style: 'soft' },
  },
  {
    key: 'daylight',
    name: 'Daylight',
    blurb: 'Bright, airy, rounded',
    theme: { mode: 'light', primary: '#2563eb', accent: '#7c3aed', background: '#f4f6fb', surface: '#ffffff', font: 'rounded', style: 'airy' },
  },
  {
    key: 'neon',
    name: 'Neon',
    blurb: 'Cyber mono, glowing',
    theme: { mode: 'dark', primary: '#a855f7', accent: '#22d3ee', background: '#0a0a12', surface: '#14121f', font: 'mono', style: 'cyber' },
  },
  {
    key: 'gold',
    name: 'Gold',
    blurb: 'Editorial serif',
    theme: { mode: 'dark', primary: '#eab308', accent: '#f59e0b', background: '#14110a', surface: '#1c1810', font: 'serif', style: 'editorial' },
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
