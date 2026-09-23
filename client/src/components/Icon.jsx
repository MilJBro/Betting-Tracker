// Minimal line-icon set (stroke, currentColor) for a clean, emoji-free UI.
const PATHS = {
  dashboard: <path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 4v4h6V4zM4 20h6v-4H4z" />,
  zap: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  house: (
    <>
      <path d="M4 12l8-7 8 7" />
      <path d="M6 11v8h12v-8" />
      <path d="M10 19v-5h4v5" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  chevron: <path d="M6 9l6 6 6-6" />,
  bets: <path d="M4 7h16M4 12h16M4 17h10" />,
  analytics: <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-8M20 16v-3" />,
  sliders: (
    <>
      <path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
      <circle cx="15" cy="8" r="2.2" />
      <circle cx="9" cy="16" r="2.2" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  log: (
    <>
      <path d="M5 4h9l5 5v11H5z" />
      <path d="M14 4v5h5M8 13h7M8 17h5" />
    </>
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="17" cy="6" r="2.4" />
      <circle cx="17" cy="18" r="2.4" />
      <path d="M8.2 10.9l6.6-3.6M8.2 13.1l6.6 3.6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4-4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L18 10l-4-4L4 16z" />
      <path d="M13 7l4 4" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h11" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17.2 17.2 0 0 1-3.4 4M6.2 6.2A17.2 17.2 0 0 0 2 12s3.5 7 10 7a10.7 10.7 0 0 0 3.9-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
      <path d="M12 13v3M9 20h6M10 20v-1.5a2 2 0 0 1 4 0V20" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 9h16M8 3v4M16 3v4" />
    </>
  ),
  bank: (
    <>
      <path d="M4 10l8-5 8 5" />
      <path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18" />
    </>
  ),
  link: (
    <>
      <path d="M9 15l6-6" />
      <path d="M11 7l1-1a3.5 3.5 0 0 1 5 5l-1 1M13 17l-1 1a3.5 3.5 0 0 1-5-5l1-1" />
    </>
  ),
  trend: (
    <>
      <path d="M4 15l5-5 4 4 7-7" />
      <path d="M17 4h4v4" />
    </>
  ),
  ball: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8l3.5 2.5-1.3 4.1h-4.4L8.5 10.5z" />
    </>
  ),
  clipboard: (
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3.2A1.2 1.2 0 0 1 10.2 2h3.6A1.2 1.2 0 0 1 15 3.2V4" />
      <path d="M9 11h6M9 15h4" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9" cy="7" rx="5" ry="2.6" />
      <path d="M4 7v4c0 1.4 2.2 2.6 5 2.6s5-1.2 5-2.6V7" />
      <path d="M14 11.2c2.4.2 4 1.2 4 2.4 0 1.4-2.2 2.6-5 2.6-1 0-2-.2-2.8-.5" />
      <path d="M10 13.6v3.2c0 1.4 2.2 2.6 5 2.6s5-1.2 5-2.6v-3.4" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7L5.6 5.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 6.5" />,
};

export default function Icon({ name, size = 20, className, style }) {
  const p = PATHS[name];
  if (!p) return null;
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {p}
    </svg>
  );
}
