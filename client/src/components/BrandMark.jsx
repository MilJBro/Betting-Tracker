// The Betbooks logo mark: an open book (your bet "book"/ledger) in the
// rounded brand badge. Colour comes from the badge (currentColor), so it
// recolours with the active theme.
export default function BrandMark() {
  return (
    <span className="brand-dot" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 6.4C10.3 5 7.7 4.5 3.8 5.1v12.7c3.9-0.6 6.5-0.1 8.2 1.3 1.7-1.4 4.3-1.9 8.2-1.3V5.1C16.3 4.5 13.7 5 12 6.4z" />
        <path d="M12 6.4v12.7" />
      </svg>
    </span>
  );
}
