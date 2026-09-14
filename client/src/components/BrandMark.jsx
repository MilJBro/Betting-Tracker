// The Betbooks logo mark: a bold open book (your bet "book"/ledger). Drawn in
// the brand green via currentColor (set on .brand-mark), standalone with no
// badge behind it — matching the horizontal Betbooks lockup.
export default function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 6.4C10.3 5 7.7 4.5 3.8 5.1v12.7c3.9-0.6 6.5-0.1 8.2 1.3 1.7-1.4 4.3-1.9 8.2-1.3V5.1C16.3 4.5 13.7 5 12 6.4z" />
        <path d="M12 6.4v12.7" />
      </svg>
    </span>
  );
}
