import BrandMark from './BrandMark.jsx';

// The full Betbooks lockup: the green book mark + the two-tone wordmark
// ("Bet" in the current text colour, "books" in brand green). Self-contained
// (its own flex + gap) so it drops into any header, auth screen or footer and
// spaces correctly regardless of the parent.
export default function Logo() {
  return (
    <span className="brand-logo">
      <BrandMark />
      <span className="wordmark">Bet<span>books</span></span>
    </span>
  );
}
