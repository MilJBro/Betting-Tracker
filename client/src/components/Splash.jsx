import Logo from './Logo.jsx';

// A calm, branded full-screen loading state — the Betbooks lockup with a slim
// indeterminate progress bar. Used for every boot gate (auth, settings) so the
// app fades up through one consistent screen instead of a series of spinners.
export default function Splash() {
  return (
    <div className="splash">
      <div className="splash-logo"><Logo /></div>
      <span className="splash-bar" aria-hidden="true" />
    </div>
  );
}
