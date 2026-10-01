import { createPortal } from 'react-dom';
import { isIOS, androidBrowser } from '../pwa.js';

// Step lists per environment. The menu wording differs between Android
// browsers, so each gets its own steps; anything unrecognised gets the generic
// ones.
const STEPS = {
  ios: [
    <>Tap the <strong>Share</strong> button at the bottom of Safari (the square with an arrow pointing up).</>,
    <>Scroll down and tap <strong>Add to Home Screen</strong>.</>,
    <>Tap <strong>Add</strong> in the top corner. Betbooks now sits on your home screen.</>,
  ],
  chrome: [
    <>Tap the <strong>⋮</strong> menu at the top right of Chrome.</>,
    <>Tap <strong>Add to Home screen</strong> (some phones say <strong>Install app</strong>).</>,
    <>Tap <strong>Install</strong> or <strong>Add</strong>. Betbooks appears with your other apps.</>,
  ],
  samsung: [
    <>Tap the <strong>≡</strong> menu at the bottom right of Samsung Internet.</>,
    <>Tap <strong>Add page to</strong>, then choose <strong>Home screen</strong>.</>,
    <>Tap <strong>Add</strong>. Betbooks appears on your home screen.</>,
  ],
  firefox: [
    <>Tap the <strong>⋮</strong> menu in Firefox.</>,
    <>Tap <strong>Install</strong> (or <strong>Add to Home screen</strong>).</>,
    <>Tap <strong>Add</strong>. Betbooks appears on your home screen.</>,
  ],
  generic: [
    <>Open your browser’s menu (the <strong>⋮</strong> or <strong>≡</strong> button).</>,
    <>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.</>,
    <>Confirm. Betbooks is added and opens in its own window.</>,
  ],
};

// Shared "how to add to home screen" steps, shown on iOS (no install API) or
// any browser that can't trigger the native prompt programmatically.
export default function InstallHowTo({ onClose }) {
  const key = isIOS() ? 'ios' : (androidBrowser() || 'generic');
  const steps = STEPS[key] || STEPS.generic;
  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="row spread" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Add to Home Screen</h2>
          <button className="btn-ghost btn-sm" type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <ol className="howto-list" data-browser={key}>
          {steps.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
